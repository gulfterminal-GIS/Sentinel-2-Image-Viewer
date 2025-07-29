// Configuration
const CLIENT_ID = "d66d799d-f3cc-463d-a5f2-176666634578";
const CLIENT_SECRET = "DPd6gOZCUJjFzurWDl9Q3VE1pegiU7vr";
let authToken = null;
let drawnItems = null;

const INDICES = {
    trueColor: {
        name: "True Color",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B02", "B03", "B04"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
            }
        `
    },
    ndvi: {
        name: "NDVI",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B04", "B08"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
                
                // Color scale for NDVI
                if (ndvi < -0.2) return [0.05, 0.05, 0.05];
                else if (ndvi < 0) return [0.75, 0.75, 0.75];
                else if (ndvi < 0.2) return [1, 1, 0.6];
                else if (ndvi < 0.4) return [0.8, 0.9, 0.3];
                else if (ndvi < 0.6) return [0.4, 0.7, 0.2];
                else return [0, 0.5, 0];
            }
        `
    },
    evi: {
        name: "EVI",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B02", "B04", "B08"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                let evi = 2.5 * (sample.B08 - sample.B04) / (sample.B08 + 6 * sample.B04 - 7.5 * sample.B02 + 1);
                
                // Color scale for EVI
                if (evi < 0) return [0.05, 0.05, 0.05];
                else if (evi < 0.2) return [0.5, 0.5, 0];
                else if (evi < 0.4) return [0.7, 0.7, 0];
                else if (evi < 0.6) return [0, 0.8, 0];
                else return [0, 0.5, 0];
            }
        `
    },
    ndwi: {
        name: "NDWI",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B03", "B08"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                let ndwi = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);
                
                // Color scale for NDWI
                if (ndwi < -0.2) return [0.8, 0.7, 0.5];
                else if (ndwi < 0) return [0.6, 0.8, 0.7];
                else if (ndwi < 0.2) return [0.4, 0.7, 0.9];
                else return [0, 0.3, 0.8];
            }
        `
    },
    ndbi: {
        name: "NDBI",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B08", "B11"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                let ndbi = (sample.B11 - sample.B08) / (sample.B11 + sample.B08);
                
                // Color scale for NDBI
                if (ndbi < -0.2) return [0, 0.2, 0];
                else if (ndbi < 0) return [0.5, 0.5, 0.5];
                else if (ndbi < 0.2) return [0.8, 0.8, 0.7];
                else return [1, 1, 0.8];
            }
        `
    },
    falseColor: {
        name: "False Color Infrared",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B08", "B04", "B03"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                return [2.5 * sample.B08, 2.5 * sample.B04, 2.5 * sample.B03];
            }
        `
    },
    agriculture: {
        name: "Agriculture",
        evalscript: `
            //VERSION=3
            function setup() {
                return {
                    input: ["B11", "B08", "B02"],
                    output: { bands: 3 }
                };
            }
            function evaluatePixel(sample) {
                return [2.5 * sample.B11, 2.5 * sample.B08, 2.5 * sample.B02];
            }
        `
    }
};


// Initialize map
const map = L.map('map').setView([30.16904486368698, 30.36237820760166], 13);
L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);



// Initialize draw controls
const drawControl = new L.Control.Draw({
    draw: {
        polygon: {
          shapeOptions: {
            color: '#3388ff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0, // This makes the shape fill transparent
            fillColor: '#3388ff'
          }
        },
        rectangle: {
          shapeOptions: {
            color: '#3388ff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0, // This makes the shape fill transparent
            fillColor: '#3388ff'
          }
        },
        circle: {
          shapeOptions: {
            color: '#3388ff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0, // This makes the shape fill transparent
            fillColor: '#3388ff'
          }
        },
        marker: false,
        polyline: false,
        circlemarker: false
    },
    // edit: {
    //   featureGroup: drawnItems,
    //   remove: true,
    //   edit: false
    // }
});
map.addControl(drawControl);

// Layer for drawn items
drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);


// Add edit toolbar as a separate control
const editControl = new L.Control.Draw({
    draw: false,
    edit: {
        featureGroup: drawnItems,
        remove: true,
        edit: {
            selectedPathOptions: {
                color: '#ff7800',
                fillColor: '#ff7800'
            }
        }
    }
});
map.addControl(editControl);

// Get authentication token
async function getAuthToken() {
    try {
        const response = await fetch('https://services.sentinel-hub.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error('Authentication error:', error);
    }
}





async function fetchMetadata(bounds, date) {
    const metadataContent = document.getElementById('metadataContent');
    metadataContent.innerHTML = '<p class="loading">Loading metadata...</p>';

    try {
        const response = await fetch('https://services.sentinel-hub.com/api/v1/catalog/1.0.0/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bbox: [
                    bounds.getWest(),
                    bounds.getSouth(),
                    bounds.getEast(),
                    bounds.getNorth()
                ],
                datetime: `${date}T00:00:00Z/${date}T23:59:59Z`,
                collections: ["sentinel-2-l2a"],
                limit: 1
            })
        });

        const data = await response.json();
if (data.features && data.features.length > 0) {
    const metadata = data.features[0].properties;
    metadataContent.innerHTML = `
        <div class="metadata-container">
            <div class="metadata-item">Acquisition Date: ${new Date(metadata.datetime).toLocaleString()}</div>
            <div class="metadata-item">Cloud Coverage: ${(metadata['eo:cloud_cover'] || 0).toFixed(2)}%</div>
            <div class="metadata-item">Orbit Direction: ${metadata['sat:orbit_state'] || 'Not available'}</div>
            <div class="metadata-item">Tile ID: ${metadata['sentinel:grid_square'] || 'Not available'}</div>
            <div class="metadata-item">Collection: ${metadata['collection'] || 'Sentinel-2 L2A'}</div>
        </div>
    `;
} else {
    metadataContent.innerHTML = '<p>No metadata available for this date</p>';
}
    } catch (error) {
        console.error('Error fetching metadata:', error);
        metadataContent.innerHTML = '<p>Error loading metadata</p>';
    }
}

// Helper functions
function calculateTrend(values) {
    const n = values.length;
    const x = Array.from({length: n}, (_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}



async function calculateStatistics(geometry, date, selectedIndex) {
    const statsContent = document.getElementById('statsContent');
    statsContent.innerHTML = '<p class="loading">Calculating statistics...</p>';

    // Get date range around the selected date
    const selectedDate = new Date(date);
    const fromDate = new Date(selectedDate);
    fromDate.setDate(fromDate.getDate() - 15); // 15 days before
    const toDate = new Date(selectedDate);
    toDate.setDate(toDate.getDate() + 15); // 15 days after

    // Get evalscript based on selected index
    const evalscript = getEvalscriptForStatistics(selectedIndex);
    
    const requestBody = {
        input: {
            bounds: {
                geometry: geometry
            },
            data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                    timeRange: {
                        from: fromDate.toISOString(),
                        to: toDate.toISOString()
                    }
                }
            }]
        },
        aggregation: {
            timeRange: {
                from: fromDate.toISOString(),
                to: toDate.toISOString()
            },
            aggregationInterval: {
                of: "P1D"
            },
            evalscript: evalscript,
            width: 512,
            height: 512
        },
        calculations: {
            default: {}
        }
    };

    try {
        const response = await fetch('https://services.sentinel-hub.com/api/v1/statistics', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        console.log('Raw response:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${responseText}`);
        }

        const stats = JSON.parse(responseText);
        
        if (stats.data && stats.data.length > 0) {
            const allResults = stats.data.map(interval => ({
                date: new Date(interval.interval.from),
                stats: interval.outputs.default.bands.B0.stats
            }));

            // Sort results by date
            allResults.sort((a, b) => a.date - b.date);

            // Get interpretation and ranges based on selected index
            const interpretation = getIndexInterpretation(selectedIndex);
            
            statsContent.innerHTML = `
                <div class="stats-container">
                    <div class="stat-section">
                        <h3>${interpretation.title} Statistics</h3>
                        <div class="interpretation">
                            ${interpretation.description}
                        </div>
                        <div class="stat-item">Current Mean: ${allResults[0].stats.mean.toFixed(4)}</div>
                        <div class="stat-item">Min: ${allResults[0].stats.min.toFixed(4)}</div>
                        <div class="stat-item">Max: ${allResults[0].stats.max.toFixed(4)}</div>
                    </div>

                    <div class="stat-section">
                        <h3>Health Assessment</h3>
                        ${getHealthAssessment(allResults[0].stats.mean, selectedIndex)}
                    </div>

                    <div class="stat-section">
                        <h3>Temporal Analysis</h3>
                        <div class="chart-container">
                            <canvas id="indexChart"></canvas>
                        </div>
                    </div>

                    <div class="stat-section">
                        <h3>Distribution</h3>
                        <div class="stat-item">Standard Deviation: ${allResults[0].stats.stDev.toFixed(4)}</div>
                        <div class="stat-item">Coefficient of Variation: ${(allResults[0].stats.stDev / allResults[0].stats.mean * 100).toFixed(2)}%</div>
                    </div>
                </div>
            `;

            // Create chart
            const ctx = document.getElementById('indexChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: allResults.map(r => r.date.toLocaleDateString()),
                    datasets: [{
                        label: `${interpretation.title} Values`,
                        data: allResults.map(r => r.stats.mean),
                        borderColor: interpretation.chartColor,
                        backgroundColor: interpretation.chartColor + '33',
                        // fill: true,
                        
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: interpretation.maxValue,
                            title: {
                                display: true,
                                text: interpretation.title
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Date'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `${interpretation.title} Temporal Trend`
                        }
                    }
                }
            });
        } else {
            statsContent.innerHTML = `
                <div class="stats-container">
                    <p>No statistics available for the selected date range.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Full error details:', error);
        statsContent.innerHTML = `
            <div class="stats-container">
                <p>Error calculating statistics: ${error.message}</p>
            </div>
        `;
    }
}

// Helper functions for different indices
function getEvalscriptForStatistics(selectedIndex) {
    const baseTemplate = (calculation) => `//VERSION=3
        function setup() {
            return {
                input: [{
                    bands: ["B02", "B03", "B04", "B08", "B11", "dataMask"],
                    units: "REFLECTANCE"
                }],
                output: [{
                    id: "default",
                    bands: 1
                }, {
                    id: "dataMask",
                    bands: 1
                }]
            }
        }

        function evaluatePixel(sample) {
            ${calculation}
            return {
                default: [value],
                dataMask: [sample.dataMask]
            };
        }`;

    switch(selectedIndex) {
        case 'ndvi':
            return baseTemplate('let value = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);');
        case 'evi':
            return baseTemplate('let value = 2.5 * (sample.B08 - sample.B04) / (sample.B08 + 6 * sample.B04 - 7.5 * sample.B02 + 1);');
        case 'ndwi':
            return baseTemplate('let value = (sample.B03 - sample.B08) / (sample.B03 + sample.B08);');
        case 'ndbi':
            return baseTemplate('let value = (sample.B11 - sample.B08) / (sample.B11 + sample.B08);');
        default:
            return baseTemplate('let value = (sample.B04 + sample.B03 + sample.B02) / 3;');
    }
}

function getIndexInterpretation(selectedIndex) {
    switch(selectedIndex) {
        case 'ndvi':
            return {
                title: 'NDVI',
                description: 'NDVI ranges from -1 to 1:<br>< 0: Water/non-vegetated<br>0.1-0.3: Sparse vegetation<br>0.3-0.6: Moderate vegetation<br>> 0.6: Dense vegetation',
                maxValue: 1,
                chartColor: 'rgb(75, 192, 92)'
            };
        case 'evi':
            return {
                title: 'EVI',
                description: 'EVI ranges from -1 to 1:<br>< 0: Non-vegetated<br>0-0.2: Sparse vegetation<br>0.2-0.5: Moderate vegetation<br>> 0.5: Dense vegetation',
                maxValue: 1,
                chartColor: 'rgb(65, 171, 93)'
            };
        case 'ndwi':
            return {
                title: 'NDWI',
                description: 'NDWI ranges from -1 to 1:<br>> 0: Water bodies<br>< 0: Non-water features',
                maxValue: 1,
                chartColor: 'rgb(43, 140, 190)'
            };
        case 'ndbi':
            return {
                title: 'NDBI',
                description: 'NDBI ranges from -1 to 1:<br>> 0: Built-up areas<br>< 0: Non-built-up areas',
                maxValue: 1,
                chartColor: 'rgb(215, 48, 39)'
            };
        default:
            return {
                title: 'Reflectance',
                description: 'True color reflectance values',
                maxValue: 1,
                chartColor: 'rgb(128, 128, 128)'
            };
    }
}

function getHealthAssessment(value, selectedIndex) {
    switch(selectedIndex) {
        case 'ndvi':
            return getNDVIHealthAssessment(value);
        case 'evi':
            return getEVIHealthAssessment(value);
        case 'ndwi':
            return getNDWIHealthAssessment(value);
        case 'ndbi':
            return getNDBIHealthAssessment(value);
        default:
            return '';
    }
}

// Add specific health assessment functions for each index
function getNDVIHealthAssessment(ndvi) {
    if (ndvi > 0.7) {
        return `
            <div class="health-assessment excellent">
                <strong>Excellent Vegetation Health</strong>
                <div>Dense, vigorous vegetation indicating optimal growth conditions.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Maintain current management practices</li>
                        <li>Monitor for consistent performance</li>
                        <li>Document successful practices</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndvi > 0.5) {
        return `
            <div class="health-assessment good">
                <strong>Good Vegetation Health</strong>
                <div>Healthy vegetation with good canopy coverage.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Continue current practices</li>
                        <li>Monitor for any changes</li>
                        <li>Consider minor optimizations</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndvi > 0.3) {
        return `
            <div class="health-assessment moderate">
                <strong>Moderate Vegetation Health</strong>
                <div>Average vegetation density, potential for improvement.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Review irrigation schedules</li>
                        <li>Check nutrient levels</li>
                        <li>Monitor for stress factors</li>
                    </ul>
                </div>
            </div>`;
    } else {
        return `
            <div class="health-assessment poor">
                <strong>Poor Vegetation Health</strong>
                <div>Sparse or stressed vegetation requiring attention.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Immediate assessment needed</li>
                        <li>Check for water stress</li>
                        <li>Evaluate soil conditions</li>
                        <li>Consider pest/disease inspection</li>
                    </ul>
                </div>
            </div>`;
    }
}

function getEVIHealthAssessment(evi) {
    if (evi > 0.5) {
        return `
            <div class="health-assessment excellent">
                <strong>Excellent Canopy Development</strong>
                <div>Robust canopy structure with high photosynthetic activity.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Maintain optimal conditions</li>
                        <li>Monitor for sustained performance</li>
                        <li>Document management practices</li>
                    </ul>
                </div>
            </div>`;
    } else if (evi > 0.3) {
        return `
            <div class="health-assessment good">
                <strong>Good Canopy Structure</strong>
                <div>Healthy canopy with good biomass development.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Continue current practices</li>
                        <li>Monitor seasonal changes</li>
                        <li>Plan for optimization</li>
                    </ul>
                </div>
            </div>`;
    } else if (evi > 0.1) {
        return `
            <div class="health-assessment moderate">
                <strong>Moderate Canopy Development</strong>
                <div>Average biomass levels with room for improvement.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Evaluate growth conditions</li>
                        <li>Check nutrient availability</li>
                        <li>Assess water management</li>
                    </ul>
                </div>
            </div>`;
    } else {
        return `
            <div class="health-assessment poor">
                <strong>Poor Canopy Structure</strong>
                <div>Limited vegetation development or high stress.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Urgent assessment needed</li>
                        <li>Review growing conditions</li>
                        <li>Check for environmental stress</li>
                    </ul>
                </div>
            </div>`;
    }
}

function getNDWIHealthAssessment(ndwi) {
    if (ndwi > 0.3) {
        return `
            <div class="health-assessment excellent">
                <strong>High Water Content</strong>
                <div>Open water or very high moisture content.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Monitor water levels</li>
                        <li>Check drainage systems</li>
                        <li>Assess water management</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndwi > 0) {
        return `
            <div class="health-assessment good">
                <strong>Adequate Moisture</strong>
                <div>Good water presence or healthy vegetation moisture.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Maintain current conditions</li>
                        <li>Monitor seasonal changes</li>
                        <li>Plan for dry periods</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndwi > -0.2) {
        return `
            <div class="health-assessment moderate">
                <strong>Moderate Moisture</strong>
                <div>Limited water content or average vegetation moisture.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Review irrigation needs</li>
                        <li>Monitor soil moisture</li>
                        <li>Plan water management</li>
                    </ul>
                </div>
            </div>`;
    } else {
        return `
            <div class="health-assessment poor">
                <strong>Low Moisture Content</strong>
                <div>Dry conditions or water stress present.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Assess irrigation needs</li>
                        <li>Check for water stress</li>
                        <li>Consider drought management</li>
                    </ul>
                </div>
            </div>`;
    }
}

function getNDBIHealthAssessment(ndbi) {
    if (ndbi > 0.3) {
        return `
            <div class="health-assessment poor">
                <strong>High Built-up Area Density</strong>
                <div>Intense urban or built-up surface presence.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Monitor urban heat island effects</li>
                        <li>Assess vegetation coverage</li>
                        <li>Consider green infrastructure</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndbi > 0) {
        return `
            <div class="health-assessment moderate">
                <strong>Moderate Built-up Density</strong>
                <div>Mixed urban and natural surfaces.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Balance development and green spaces</li>
                        <li>Monitor surface temperature</li>
                        <li>Plan urban greening</li>
                    </ul>
                </div>
            </div>`;
    } else if (ndbi > -0.2) {
        return `
            <div class="health-assessment good">
                <strong>Low Built-up Density</strong>
                <div>Predominantly natural or vegetated surfaces.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Maintain green spaces</li>
                        <li>Monitor land use changes</li>
                        <li>Preserve natural areas</li>
                    </ul>
                </div>
            </div>`;
    } else {
        return `
            <div class="health-assessment excellent">
                <strong>Natural Surface Dominance</strong>
                <div>Minimal built-up surface presence.</div>
                <div class="health-recommendations">
                    Recommendations:
                    <ul>
                        <li>Preserve current conditions</li>
                        <li>Monitor development pressure</li>
                        <li>Maintain ecological balance</li>
                    </ul>
                </div>
            </div>`;
    }
}

// Add similar functions for other indices...

function showInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.classList.add('show');
    isPanelMinimized = false;

    if (window.innerWidth <= 768) {
        const handle = infoPanel.querySelector('.panel-handle');
        let startY = 0;
        let startTransform = 0;

        handle.addEventListener('touchstart', handleTouchStart);
        
        function handleTouchStart(e) {
            startY = e.touches[0].clientY;
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
        }

        function handleTouchMove(e) {
            const currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) { // Only allow dragging down
                infoPanel.style.transform = `translateY(${deltaY}px)`;
            }
        }

        function handleTouchEnd(e) {
            const deltaY = e.changedTouches[0].clientY - startY;
            
            if (deltaY > 100) { // If dragged down significantly
                infoPanel.classList.add('minimized');
                infoPanel.querySelector('.panel-content').style.display = 'none';
                infoPanel.querySelector('.toggle-panel').textContent = '+';
                isPanelMinimized = true;
            } else {
                infoPanel.style.transform = '';
            }

            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        }
    }
}

function hideInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.classList.remove('show');
}

// Add these functions at the beginning of your script
function showLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}


// Load Sentinel image
async function loadSentinelImage() {
    if (drawnItems.getLayers().length === 0) {
        alert('Please draw a shape first');
        return;
    }

    const drawnLayer = drawnItems.getLayers()[0];
    let geometry;

    // Convert the drawn shape to GeoJSON geometry
    if (drawnLayer instanceof L.Circle) {
        const center = drawnLayer.getLatLng();
        const radius = drawnLayer.getRadius();
        const points = 32;
        const coordinates = [[]];
        
        for (let i = 0; i < points; i++) {
            const angle = (i * 360) / points;
            const rad = (angle * Math.PI) / 180;
            const lat = center.lat + (radius / 111319.9) * Math.cos(rad);
            const lng = center.lng + (radius / (111319.9 * Math.cos(center.lat * Math.PI / 180))) * Math.sin(rad);
            coordinates[0].push([lng, lat]);
        }
        coordinates[0].push(coordinates[0][0]); // Close the polygon

        geometry = {
            type: "Polygon",
            coordinates: coordinates
        };
    } else {
        geometry = drawnLayer.toGeoJSON().geometry;
    }

    const date = document.getElementById('dateSelector').value;
    const fromDate = `${date}T00:00:00Z`;
    const toDate = `${date}T23:59:59Z`;

    const selectedIndex = document.getElementById('indexSelector').value;
    const indexConfig = INDICES[selectedIndex];

    const requestBody = {
        input: {
            bounds: {
                geometry: geometry
            },
            data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                    timeRange: {
                        from: fromDate,
                        to: toDate
                    }
                }
            }]
        },
        output: {
            width: 512,
            height: 512,
            responses: [
                {
                    identifier: "default",
                    format: {
                        type: "image/jpeg"
                    }
                }
            ]
        },
        evalscript: indexConfig.evalscript
    };

    try {
        
        showLoading(); // Show loading at the start
        const response = await fetch('https://services.sentinel-hub.com/api/v1/process', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            
            // Remove previous overlay if exists
            drawnItems.eachLayer((layer) => {
                if (layer instanceof L.ImageOverlay) {
                    drawnItems.removeLayer(layer);
                }
            });
            
            // Add image overlay to map using the bounds of the drawn shape
            const bounds = drawnLayer.getBounds();
            L.imageOverlay(imageUrl, bounds).addTo(map);

            // After successful image load, fetch metadata and calculate statistics
            const date = document.getElementById('dateSelector').value;
            const selectedIndex = document.getElementById('indexSelector').value;
            
            // After successful load
            if (window.innerWidth <= 768) {
                showInfoPanel();
            }

            await Promise.all([
            fetchMetadata(drawnLayer.getBounds(), date),
            calculateStatistics(geometry, date, selectedIndex)
            ]);


        } else {
            console.error('Failed to load image:', response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
        }


    } catch (error) {
        console.error('Error loading image:', error);
    } finally {
        hideLoading(); // Hide loading when everything is done
    }
}


document.getElementById('indexSelector').addEventListener('change', function() {
    if (drawnItems.getLayers().length > 0) {
        loadSentinelImage();
    }
});


// Event Handlers
map.on('draw:created', function(e) {
    const layer = e.layer;
    layer.setStyle({
        fillOpacity: 0,
        opacity: 1,
        weight: 3
    });
    drawnItems.clearLayers();
    drawnItems.addLayer(layer);
});

document.getElementById('loadImage').addEventListener('click', loadSentinelImage);



// // Handle editing events
// map.on('draw:edited', function(e) {
//     const layers = e.layers;
//     layers.eachLayer(function(layer) {
//         // Refresh statistics and image after edit
//         loadSentinelImage();
//     });
// });

// Handle deletion events
map.on('draw:deleted', function(e) {
    // Clear statistics and metadata when shape is deleted
    document.getElementById('statsContent').innerHTML = '<p>Draw a shape to view statistics</p>';
    document.getElementById('metadataContent').innerHTML = '<p>Draw a shape to view metadata</p>';
});



// Add this to your script
document.getElementById('clearButton').addEventListener('click', function() {
    drawnItems.clearLayers();
    document.getElementById('statsContent').innerHTML = '<p>Draw a shape to view statistics</p>';
    document.getElementById('metadataContent').innerHTML = '<p>Draw a shape to view metadata</p>';
});




function initializeDatePicker() {
    const today = new Date();
    const dateInput = document.getElementById('dateSelector');
    const calendar = document.getElementById('calendar');
    
    // Set initial value
    dateInput.value = today.toISOString().split('T')[0];

    // Initialize Vanilla Calendar
    const vanillaCalendar = new VanillaCalendar('#calendar', {
        date: {
            min: '2015-06-23',
            max: today.toISOString().split('T')[0],
            today: today
        },
        settings: {
            lang: 'en',
            iso8601: true,
            selection: {
                day: 'single'
            }
        },
        actions: {
            clickDay(e, dates) {
                if (dates.length) {
                    dateInput.value = dates[0];
                    hideCalendar();
                }
            }
        }
    });

    vanillaCalendar.init();

    // Show/hide calendar
    function showCalendar() {
        calendar.classList.add('show');
        document.addEventListener('click', handleOutsideClick);
    }

    function hideCalendar() {
        calendar.classList.remove('show');
        document.removeEventListener('click', handleOutsideClick);
    }

    function handleOutsideClick(e) {
        if (!calendar.contains(e.target) && !dateInput.contains(e.target)) {
            hideCalendar();
        }
    }

    // Add click handler to input
    dateInput.addEventListener('click', (e) => {
        e.stopPropagation();
        showCalendar();
    });
}

// Update your window.onload function
window.onload = async () => {
    try {
        authToken = await getAuthToken();
        initializeDatePicker();
    } catch (error) {
        console.error('Error initializing:', error);
    }
};
// // Initialize authentication on page load
// // In your window.onload function:
// window.onload = async () => {
//     authToken = await getAuthToken();
    
//     // Update the date handling
//     const dateInput = document.getElementById('dateSelector');
//     const today = new Date();
//     const thirtyDaysAgo = new Date(today);
//     // thirtyDaysAgo.setDate(today.getDate() - 30);

//     dateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
//     dateInput.min = "2015-06-23"; // Sentinel-2 launch date
//     dateInput.max = today.toISOString().split('T')[0];
// };


// Add these functions to your existing JavaScript

// Toggle Info Panel
let isPanelMinimized = false;

document.querySelector('.toggle-panel').addEventListener('click', function(e) {
    e.stopPropagation();
    const panel = document.getElementById('infoPanel');
    const content = panel.querySelector('.panel-content');
    const button = this;

    if (window.innerWidth <= 768) {
        if (isPanelMinimized) {
            panel.classList.remove('minimized');
            content.style.display = 'block';
            button.textContent = '−';
            isPanelMinimized = false;
        } else {
            panel.classList.add('minimized');
            content.style.display = 'none';
            button.textContent = '+';
            isPanelMinimized = true;
        }
    } else {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            button.textContent = '−';
        } else {
            content.style.display = 'none';
            button.textContent = '+';
        }
    }
});

// Add click handler for the panel header on mobile
document.querySelector('.panel-header').addEventListener('click', function(e) {
    if (window.innerWidth <= 768 && isPanelMinimized && !e.target.classList.contains('toggle-panel')) {
        const panel = document.getElementById('infoPanel');
        const content = panel.querySelector('.panel-content');
        const button = panel.querySelector('.toggle-panel');
        
        panel.classList.remove('minimized');
        content.style.display = 'block';
        button.textContent = '−';
        isPanelMinimized = false;
    }
});



// Make panels draggable
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.querySelector('.panel-header').onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Initialize draggable panels
makeDraggable(document.getElementById('infoPanel'));



