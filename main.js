const utils = require('@iobroker/adapter-core');

class SolarAdapter extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'solar-calculator',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
        
        this.updateInterval = null;
        this.currentSolarData = null;
    }

    async onReady() {
        this.log.info('Solar Calculator Adapter gestartet');
        
        // Erstelle Adapter-Objekte
        await this.createObjects();
        
        // Lade Konfiguration
        await this.loadConfiguration();
        
        // Starte erste Berechnung
        await this.calculateSolarData();
        
        // Setze Update-Intervall (alle 5 Minuten)
        this.updateInterval = setInterval(() => {
            this.calculateSolarData();
        }, 5 * 60 * 1000);
    }

    async createObjects() {
        // Konfiguration
        await this.setObjectNotExists('config.latitude', {
            type: 'state',
            common: {
                name: 'Breitengrad',
                type: 'number',
                role: 'value.gps.latitude',
                read: true,
                write: true,
                def: 53.55
            },
            native: {}
        });

        await this.setObjectNotExists('config.longitude', {
            type: 'state',
            common: {
                name: 'Längengrad',
                type: 'number',
                role: 'value.gps.longitude',
                read: true,
                write: true,
                def: 10.0
            },
            native: {}
        });

        await this.setObjectNotExists('config.roofAzimuth', {
            type: 'state',
            common: {
                name: 'Dachausrichtung (0°=N, 90°=O, 180°=S, 270°=W)',
                type: 'number',
                role: 'value',
                read: true,
                write: true,
                def: 180,
                min: 0,
                max: 360
            },
            native: {}
        });

        await this.setObjectNotExists('config.roofTilt', {
            type: 'state',
            common: {
                name: 'Dachneigung in Grad',
                type: 'number',
                role: 'value',
                read: true,
                write: true,
                def: 30,
                min: 0,
                max: 90
            },
            native: {}
        });

        await this.setObjectNotExists('config.maxIncidenceAngle', {
            type: 'state',
            common: {
                name: 'Max. Einstrahlwinkel (0°=senkrecht, 90°=parallel)',
                type: 'number',
                role: 'value',
                read: true,
                write: true,
                def: 60,
                min: 0,
                max: 90
            },
            native: {}
        });

        // Aktuelle Werte
        await this.setObjectNotExists('current.sunOnRoof', {
            type: 'state',
            common: {
                name: 'Sonne scheint auf Dach',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExists('current.sunElevation', {
            type: 'state',
            common: {
                name: 'Sonnenhöhe in Grad',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
                unit: '°'
            },
            native: {}
        });

        await this.setObjectNotExists('current.sunAzimuth', {
            type: 'state',
            common: {
                name: 'Sonnenazimut in Grad',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
                unit: '°'
            },
            native: {}
        });

        await this.setObjectNotExists('current.incidenceAngle', {
            type: 'state',
            common: {
                name: 'Einstrahlwinkel auf Dach',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
                unit: '°'
            },
            native: {}
        });

        await this.setObjectNotExists('current.cosIncidence', {
            type: 'state',
            common: {
                name: 'Kosinus Einstrahlwinkel (Effizienz)',
                type: 'number',
                role: 'value',
                read: true,
                write: false
            },
            native: {}
        });

        // Tageszeiten
        await this.setObjectNotExists('today.firstSun', {
            type: 'state',
            common: {
                name: 'Erste Sonneneinstrahlung heute',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExists('today.lastSun', {
            type: 'state',
            common: {
                name: 'Letzte Sonneneinstrahlung heute',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExists('today.sunDuration', {
            type: 'state',
            common: {
                name: 'Sonnenscheindauer heute',
                type: 'number',
                role: 'value',
                read: true,
                write: false,
                unit: 'h'
            },
            native: {}
        });

        await this.setObjectNotExists('today.maxEfficiency', {
            type: 'state',
            common: {
                name: 'Maximale Effizienz heute',
                type: 'number',
                role: 'value',
                read: true,
                write: false
            },
            native: {}
        });

        await this.setObjectNotExists('today.maxEfficiencyTime', {
            type: 'state',
            common: {
                name: 'Uhrzeit maximaler Effizienz',
                type: 'string',
                role: 'text',
                read: true,
                write: false
            },
            native: {}
        });
    }

    async loadConfiguration() {
        this.config = {
            latitude: await this.getStateAsync('config.latitude'),
            longitude: await this.getStateAsync('config.longitude'),
            roofAzimuth: await this.getStateAsync('config.roofAzimuth'),
            roofTilt: await this.getStateAsync('config.roofTilt'),
            maxIncidenceAngle: await this.getStateAsync('config.maxIncidenceAngle')
        };

        // Standardwerte setzen falls nicht vorhanden
        Object.keys(this.config).forEach(key => {
            if (!this.config[key] || this.config[key].val === null) {
                this.config[key] = { val: this.getDefaultValue(key) };
            }
        });
    }

    getDefaultValue(key) {
        const defaults = {
            latitude: 53.55,
            longitude: 10.0,
            roofAzimuth: 180,
            roofTilt: 30,
            maxIncidenceAngle: 60
        };
        return defaults[key] || 0;
    }

    // Berücksichtigung von Sommerzeit/Winterzeit
    getLocalTime(date) {
        const now = date || new Date();
        
        // Prüfe ob Sommerzeit aktiv ist (letzter Sonntag im März bis letzter Sonntag im Oktober)
        const year = now.getFullYear();
        const marchLastSunday = this.getLastSunday(year, 2); // März = 2
        const octoberLastSunday = this.getLastSunday(year, 9); // Oktober = 9
        
        const isDST = now >= marchLastSunday && now < octoberLastSunday;
        
        // UTC+1 (Winterzeit) oder UTC+2 (Sommerzeit)
        const offset = isDST ? 2 : 1;
        
        return {
            localTime: new Date(now.getTime() + offset * 60 * 60 * 1000),
            isDST: isDST,
            offset: offset
        };
    }

    getLastSunday(year, month) {
        const date = new Date(year, month + 1, 0); // Letzter Tag des Monats
        const dayOfWeek = date.getDay();
        const lastSunday = new Date(date.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        lastSunday.setHours(2, 0, 0, 0); // 2:00 Uhr
        return lastSunday;
    }

    async calculateSolarData() {
        try {
            await this.loadConfiguration();
            
            const timeInfo = this.getLocalTime();
            const now = timeInfo.localTime;
            const dayOfYear = this.getDayOfYear(now);
            
            // Berechne Sonneneinstrahlung für aktuellen Zeitpunkt
            const currentSolar = this.calculateSunPosition(
                this.config.latitude.val,
                this.config.longitude.val,
                dayOfYear,
                now.getHours() + now.getMinutes() / 60,
                this.config.roofAzimuth.val,
                this.config.roofTilt.val,
                this.config.maxIncidenceAngle.val
            );

            // Aktualisiere aktuelle Werte
            if (currentSolar.sunOnRoof) {
                await this.setStateAsync('current.sunOnRoof', true, true);
                await this.setStateAsync('current.sunElevation', currentSolar.elevation, true);
                await this.setStateAsync('current.sunAzimuth', currentSolar.azimuth, true);
                await this.setStateAsync('current.incidenceAngle', currentSolar.incidenceAngle, true);
                await this.setStateAsync('current.cosIncidence', currentSolar.cosIncidence, true);
            } else {
                await this.setStateAsync('current.sunOnRoof', false, true);
                await this.setStateAsync('current.sunElevation', 0, true);
                await this.setStateAsync('current.sunAzimuth', 0, true);
                await this.setStateAsync('current.incidenceAngle', 0, true);
                await this.setStateAsync('current.cosIncidence', 0, true);
            }

            // Berechne Tageszeiten
            const dailyData = this.calculateDailyTimes(
                this.config.latitude.val,
                this.config.longitude.val,
                dayOfYear,
                this.config.roofAzimuth.val,
                this.config.roofTilt.val,
                this.config.maxIncidenceAngle.val,
                timeInfo.offset
            );

            if (dailyData.firstSun) {
                await this.setStateAsync('today.firstSun', dailyData.firstSun, true);
                await this.setStateAsync('today.lastSun', dailyData.lastSun, true);
                await this.setStateAsync('today.sunDuration', dailyData.duration, true);
                await this.setStateAsync('today.maxEfficiency', dailyData.maxEfficiency, true);
                await this.setStateAsync('today.maxEfficiencyTime', dailyData.maxEfficiencyTime, true);
            } else {
                await this.setStateAsync('today.firstSun', 'Keine Sonne', true);
                await this.setStateAsync('today.lastSun', 'Keine Sonne', true);
                await this.setStateAsync('today.sunDuration', 0, true);
                await this.setStateAsync('today.maxEfficiency', 0, true);
                await this.setStateAsync('today.maxEfficiencyTime', 'Keine Sonne', true);
            }

            this.log.debug(`Solar-Daten aktualisiert. Sonne auf Dach: ${currentSolar.sunOnRoof}`);
            
        } catch (error) {
            this.log.error(`Fehler bei Solar-Berechnung: ${error.message}`);
        }
    }

    calculateSunPosition(latitude, longitude, dayOfYear, timeDecimal, roofAzimuth, roofTilt, maxIncidenceAngle) {
        const EARTH_TILT = 23.45;
        
        // Deklination der Sonne
        const declination = EARTH_TILT * Math.sin(Math.PI / 180 * (360 * (284 + dayOfYear) / 365));
        
        // Konvertierung in Radiant
        const latRad = latitude * Math.PI / 180;
        const declRad = declination * Math.PI / 180;
        const roofAzimuthRad = roofAzimuth * Math.PI / 180;
        const roofTiltRad = roofTilt * Math.PI / 180;
        
        // Stundenwinkel der Sonne
        const hourAngle = (timeDecimal - 12) * 15 * Math.PI / 180;
        
        // Sonnenhöhe
        const sinElevation = Math.sin(latRad) * Math.sin(declRad) + 
                            Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngle);
        
        if (sinElevation <= 0) {
            return { sunOnRoof: false };
        }
        
        const elevation = Math.asin(sinElevation);
        
        // Sonnenazimut
        const cosAzimuth = (Math.sin(declRad) - Math.sin(latRad) * sinElevation) / 
                          (Math.cos(latRad) * Math.cos(elevation));
        
        let azimuth;
        if (Math.cos(hourAngle) >= 0) {
            azimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
        } else {
            azimuth = 2 * Math.PI - Math.acos(Math.max(-1, Math.min(1, cosAzimuth)));
        }
        
        // Einstrahlungswinkel auf Dachfläche
        const cosIncidence = Math.sin(elevation) * Math.cos(roofTiltRad) + 
                            Math.cos(elevation) * Math.sin(roofTiltRad) * 
                            Math.cos(azimuth - roofAzimuthRad);
        
        if (cosIncidence <= 0) {
            return { sunOnRoof: false };
        }
        
        const incidenceAngle = Math.acos(cosIncidence) * 180 / Math.PI;
        
        if (incidenceAngle > maxIncidenceAngle) {
            return { sunOnRoof: false };
        }
        
        return {
            sunOnRoof: true,
            elevation: elevation * 180 / Math.PI,
            azimuth: azimuth * 180 / Math.PI,
            incidenceAngle: incidenceAngle,
            cosIncidence: cosIncidence
        };
    }

    calculateDailyTimes(latitude, longitude, dayOfYear, roofAzimuth, roofTilt, maxIncidenceAngle, timezoneOffset) {
        const times = [];
        let maxEfficiency = 0;
        let maxEfficiencyTime = '';
        
        // Berechne für jede halbe Stunde
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const timeDecimal = hour + minute / 60;
                const solar = this.calculateSunPosition(latitude, longitude, dayOfYear, timeDecimal, roofAzimuth, roofTilt, maxIncidenceAngle);
                
                if (solar.sunOnRoof) {
                    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                    times.push({ time: timeStr, efficiency: solar.cosIncidence });
                    
                    if (solar.cosIncidence > maxEfficiency) {
                        maxEfficiency = solar.cosIncidence;
                        maxEfficiencyTime = timeStr;
                    }
                }
            }
        }
        
        if (times.length === 0) {
            return { firstSun: null, lastSun: null, duration: 0, maxEfficiency: 0, maxEfficiencyTime: '' };
        }
        
        return {
            firstSun: times[0].time,
            lastSun: times[times.length - 1].time,
            duration: times.length * 0.5,
            maxEfficiency: Math.round(maxEfficiency * 1000) / 1000,
            maxEfficiencyTime: maxEfficiencyTime
        };
    }

    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        const diff = date - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    onStateChange(id, state) {
        if (state && !state.ack && id.includes('config.')) {
            this.log.info(`Konfiguration geändert: ${id} = ${state.val}`);
            // Neuberechnung nach Konfigurationsänderung
            setTimeout(() => {
                this.calculateSolarData();
            }, 1000);
        }
    }

    onUnload(callback) {
        try {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            this.log.info('Solar Calculator Adapter beendet');
            callback();
        } catch (e) {
            callback();
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    module.exports = (options) => new SolarAdapter(options);
} else {
    new SolarAdapter();
}
