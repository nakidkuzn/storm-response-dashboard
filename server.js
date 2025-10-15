require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const WebSocket = require('ws');

class CombinedDashboard {
    constructor() {
        // Samsara Configuration (Fleet Tracking Only)
        this.samsaraConfig = {
            baseURL: 'https://api.samsara.com',
            apiKey: process.env.SAMSARA_API_KEY,
            fleetId: process.env.SAMSARA_FLEET_ID
        };
        
        // SiteFotos Configuration (Forms & Photos)
        this.siteFotosConfig = {
            baseURL: process.env.SITEFOTOS_API_URL || 'https://api.sitefotos.com',
            apiKey: process.env.SITEFOTOS_API_KEY,
            projectId: process.env.SITEFOTOS_PROJECT_ID
        };

        // SmartThings Configuration
        this.smartThingsConfig = {
            baseURL: 'https://api.smartthings.com/v1',
            token: process.env.SMARTTHINGS_TOKEN,
            locationId: process.env.SMARTTHINGS_LOCATION_ID
        };
        
        this.vehicleLocations = [];
        this.geofenceAlerts = [];
        this.siteFotosForms = [];
        this.stormPhotos = [];
        
        this.displays = [
            { 
                id: process.env.DISPLAY_1_ID || 'display-1',
                ip: '10.1.10.41', 
                name: 'Display 1', 
                model: 'LH55BECHLGFXGO'
            },
            { 
                id: process.env.DISPLAY_2_ID || 'display-2',
                ip: '10.1.10.42', 
                name: 'Display 2', 
                model: 'LH55BECHLGFXGO'
            },
            { 
                id: process.env.DISPLAY_3_ID || 'display-3',
                ip: '10.1.10.43', 
                name: 'Display 3', 
                model: 'LH55BECHLGFXGO'
            },
            { 
                id: process.env.DISPLAY_4_ID || 'display-4',
                ip: '10.1.10.44', 
                name: 'Display 4', 
                model: 'LH55BECHLGFXGO'
            }
        ];
        
        this.setupWebSocket();
        this.startDataPolling();
        
        console.log('🌪️  Storm Response Dashboard Initialized');
        console.log('📍 Samsara API:', this.samsaraConfig.apiKey ? 'Configured' : 'Not Configured');
        console.log('📍 SiteFotos API:', this.siteFotosConfig.apiKey ? 'Configured' : 'Not Configured');
        console.log('📍 SmartThings:', this.smartThingsConfig.token ? 'Configured' : 'Not Configured');
    }

    // ========================
    // SAMSARA API METHODS
    // ========================
    
    async getSamsaraVehicleLocations() {
        if (!this.samsaraConfig.apiKey) {
            console.log('⚠️  Samsara API key not configured - using mock data');
            return this.getMockVehicleData();
        }

        try {
            const response = await axios.get(
                `${this.samsaraConfig.baseURL}/fleet/vehicles/locations`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.samsaraConfig.apiKey}`
                    },
                    timeout: 10000
                }
            );
            
            this.vehicleLocations = response.data.data || [];
            console.log(`📍 Retrieved ${this.vehicleLocations.length} vehicles from Samsara`);
            return this.vehicleLocations;
        } catch (error) {
            console.error('❌ Samsara Vehicles Error:', error.message);
            return this.getMockVehicleData();
        }
    }

    async getGeofenceAlerts() {
        const alerts = [];
        
        this.vehicleLocations.forEach(vehicle => {
            if (this.isVehicleStationary(vehicle)) {
                alerts.push({
                    type: 'STATIONARY_VEHICLE',
                    severity: 'warning',
                    vehicle: vehicle.name || `Vehicle ${vehicle.id}`,
                    duration: this.getStationaryDuration(vehicle),
                    message: `${vehicle.name || `Vehicle ${vehicle.id}`} stationary for ${this.getStationaryDuration(vehicle)}`
                });
            }
        });
        
        this.geofenceAlerts = alerts;
        return alerts;
    }

    isVehicleStationary(vehicle) {
        if (!vehicle.location || !vehicle.location.time) return false;
        const lastUpdate = new Date(vehicle.location.time);
        const minutesStationary = (Date.now() - lastUpdate) / (1000 * 60);
        return minutesStationary > 30;
    }

    getStationaryDuration(vehicle) {
        if (!vehicle.location || !vehicle.location.time) return 'Unknown';
        const lastUpdate = new Date(vehicle.location.time);
        const hours = Math.floor((Date.now() - lastUpdate) / (1000 * 60 * 60));
        const minutes = Math.floor(((Date.now() - lastUpdate) % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    // ========================
    // SITEFOTOS API METHODS
    // ========================
    
    async getSiteFotosForms() {
        if (!this.siteFotosConfig.apiKey) {
            console.log('⚠️  SiteFotos API key not configured - using mock data');
            return this.getMockSiteFotosForms();
        }

        try {
            const response = await axios.get(
                `${this.siteFotosConfig.baseURL}/forms/recent`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.siteFotosConfig.apiKey}`,
                        'Project-ID': this.siteFotosConfig.projectId
                    },
                    timeout: 10000
                }
            );
            
            this.siteFotosForms = response.data.forms || [];
            return this.siteFotosForms;
        } catch (error) {
            console.error('❌ SiteFotos Forms Error:', error.message);
            return this.getMockSiteFotosForms();
        }
    }

    async getSiteFotosPhotos() {
        if (!this.siteFotosConfig.apiKey) {
            return this.getMockStormPhotos();
        }

        try {
            const response = await axios.get(
                `${this.siteFotosConfig.baseURL}/photos/recent`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.siteFotosConfig.apiKey}`,
                        'Project-ID': this.siteFotosConfig.projectId
                    },
                    timeout: 10000
                }
            );
            
            this.stormPhotos = response.data.photos || [];
            return this.stormPhotos;
        } catch (error) {
            console.error('❌ SiteFotos Photos Error:', error.message);
            return this.getMockStormPhotos();
        }
    }

    // ========================
    // SMARTTHINGS DISPLAY CONTROL
    // ========================
    
    async controlDisplay(displayId, command, value = null) {
        if (!this.smartThingsConfig.token) {
            console.log('⚠️  SmartThings not configured - simulating display control');
            return { success: true, simulated: true };
        }

        try {
            const response = await axios.post(
                `${this.smartThingsConfig.baseURL}/devices/${displayId}/commands`,
                {
                    commands: [
                        {
                            component: 'main',
                            capability: this.getCommandCapability(command),
                            command: this.getCommandName(command),
                            arguments: value ? [value] : []
                        }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.smartThingsConfig.token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000
                }
            );
            
            console.log(`✅ Display command ${command} sent to ${displayId}`);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`❌ SmartThings Error for ${displayId}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    getCommandCapability(command) {
        const capabilities = {
            'power_on': 'switch',
            'power_off': 'switch',
            'set_input': 'videoInputSource',
            'set_volume': 'audioVolume'
        };
        return capabilities[command] || 'switch';
    }

    getCommandName(command) {
        const commands = {
            'power_on': 'on',
            'power_off': 'off',
            'set_input': 'setInputSource',
            'set_volume': 'setVolume'
        };
        return commands[command] || command;
    }

    async activateStormDashboard(displayIndex) {
        const display = this.displays[displayIndex];
        if (!display) {
            throw new Error(`Display ${displayIndex} not found`);
        }

        console.log(`🎯 Activating storm dashboard on ${display.name}`);
        
        // Power on display
        await this.controlDisplay(display.id, 'power_on');
        await this.delay(2000);
        
        // Set input source
        await this.controlDisplay(display.id, 'set_input', 'HDMI1');
        
        // Set volume to low
        await this.controlDisplay(display.id, 'set_volume', 15);
        
        return {
            success: true,
            display: display.name,
            displayUrl: `http://${getServerIP()}:3000/dashboard?display=${displayIndex}`
        };
    }

    // ========================
    // MOCK DATA FOR DEMO
    // ========================
    
    getMockVehicleData() {
        return [
            {
                id: '12345',
                name: 'Service Truck 101',
                location: {
                    latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
                    longitude: -74.0060 + (Math.random() - 0.5) * 0.1,
                    address: 'Downtown Area',
                    time: new Date().toISOString()
                }
            },
            {
                id: '12346',
                name: 'Response Van 202',
                location: {
                    latitude: 40.7282 + (Math.random() - 0.5) * 0.1,
                    longitude: -74.0776 + (Math.random() - 0.5) * 0.1,
                    address: 'Northside District',
                    time: new Date(Date.now() - 45 * 60 * 1000).toISOString() // 45 minutes ago
                }
            }
        ];
    }

    getMockSiteFotosForms() {
        return [
            {
                id: 'SF-' + Date.now(),
                timestamp: new Date().toISOString(),
                formType: 'Storm Damage Assessment',
                site: 'Downtown Commercial District',
                status: 'Urgent',
                submittedBy: 'John Smith - Crew A',
                photos: ['/api/sitefotos/photo1.jpg'],
                details: {
                    damageType: 'Fallen Trees & Power Lines',
                    severity: 'High',
                    crewOnSite: true
                },
                location: { lat: 40.7128, lng: -74.0060 }
            }
        ];
    }

    getMockStormPhotos() {
        return [
            {
                id: 'P-' + Date.now(),
                timestamp: new Date().toISOString(),
                url: '/api/sitefotos/storm-demo.jpg',
                description: 'Storm damage assessment photo',
                submittedBy: 'Demo User'
            }
        ];
    }

    // ========================
    // WEB SOCKET & DATA MANAGEMENT
    // ========================
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ noServer: true });
        
        this.wss.on('connection', (ws) => {
            console.log('📡 Dashboard client connected');
            
            ws.send(JSON.stringify({
                type: 'INITIAL_DATA',
                vehicles: this.vehicleLocations,
                geofenceAlerts: this.geofenceAlerts,
                forms: this.siteFotosForms,
                photos: this.stormPhotos
            }));
        });
    }

    startDataPolling() {
        // Update vehicle data every 30 seconds
        setInterval(async () => {
            await this.getSamsaraVehicleLocations();
            await this.getGeofenceAlerts();
            
            this.broadcastToClients({
                type: 'VEHICLE_UPDATE',
                vehicles: this.vehicleLocations,
                geofenceAlerts: this.geofenceAlerts
            });
        }, 30000);

        // Update SiteFotos data every minute
        setInterval(async () => {
            await this.getSiteFotosForms();
            await this.getSiteFotosPhotos();
            
            this.broadcastToClients({
                type: 'SITEFOTOS_UPDATE', 
                forms: this.siteFotosForms,
                photos: this.stormPhotos
            });
        }, 60000);
    }

    broadcastToClients(data) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(data));
            }
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getDashboardStats() {
        const stationaryVehicles = this.vehicleLocations.filter(v => this.isVehicleStationary(v)).length;
        const urgentForms = this.siteFotosForms.filter(f => f.status === 'Urgent').length;
        
        return {
            totalVehicles: this.vehicleLocations.length,
            stationaryVehicles: stationaryVehicles,
            activeAlerts: this.geofenceAlerts.length,
            totalForms: this.siteFotosForms.length,
            urgentForms: urgentForms,
            recentPhotos: this.stormPhotos.length
        };
    }
}

// Helper function to get server IP
function getServerIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

// Initialize server
const app = express();
const server = http.createServer(app);
const dashboard = new CombinedDashboard();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/ws') {
        dashboard.wss.handleUpgrade(request, socket, head, (ws) => {
            dashboard.wss.emit('connection', ws, request);
        });
    }
});

// ========================
// API ENDPOINTS
// ========================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Dashboard data
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = dashboard.getDashboardStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Samsara data
app.get('/api/samsara/vehicles', async (req, res) => {
    try {
        const vehicles = await dashboard.getSamsaraVehicleLocations();
        res.json({ success: true, data: vehicles });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// SiteFotos data
app.get('/api/sitefotos/forms', async (req, res) => {
    try {
        const forms = await dashboard.getSiteFotosForms();
        res.json({ success: true, data: forms });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Webhook endpoints for SiteFotos
app.post('/api/sitefotos/forms/submit', async (req, res) => {
    try {
        const formData = req.body;
        dashboard.siteFotosForms.unshift({
            id: 'SF-' + Date.now(),
            timestamp: new Date().toISOString(),
            ...formData
        });
        
        dashboard.broadcastToClients({
            type: 'NEW_SITEFOTOS_FORM',
            form: formData
        });
        
        res.json({ success: true, message: 'Form submitted to dashboard' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ViKi Stream Dock endpoint
app.get('/api/viki/storm-dashboard/:displayIndex', async (req, res) => {
    try {
        const { displayIndex } = req.params;
        const result = await dashboard.activateStormDashboard(parseInt(displayIndex));
        
        res.json({
            success: true,
            message: `🎯 Storm Response Dashboard activated on ${result.display}`,
            display: result.display,
            dashboardUrl: result.displayUrl,
            viki: true
        });
    } catch (error) {
        res.json({ success: false, error: error.message, viki: true });
    }
});

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 Storm Response Dashboard Started!');
    console.log('=========================================');
    console.log(`📍 Server running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${getServerIP()}:${PORT}`);
    console.log('\n🎯 ViKi Stream Dock URLs:');
    console.log(`   Display 1: http://localhost:${PORT}/api/viki/storm-dashboard/0`);
    console.log(`   Display 2: http://localhost:${PORT}/api/viki/storm-dashboard/1`);
    console.log(`   Display 3: http://localhost:${PORT}/api/viki/storm-dashboard/2`);
    console.log(`   Display 4: http://localhost:${PORT}/api/viki/storm-dashboard/3`);
    console.log('\n📊 Dashboard:');
    console.log(`   Main Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`   Health Check: http://localhost:${PORT}/api/health`);
    console.log('\n⚠️  Remember to configure your API keys in the .env file!');
});
