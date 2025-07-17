# ioBroker Solar Calculator Adapter

![Logo](admin/solar-calculator.png)

[![NPM version](https://img.shields.io/npm/v/iobroker.solar-calculator.svg)](https://www.npmjs.com/package/iobroker.solar-calculator)
[![Downloads](https://img.shields.io/npm/dm/iobroker.solar-calculator.svg)](https://www.npmjs.com/package/iobroker.solar-calculator)
[![Dependency Status](https://img.shields.io/david/yourusername/iobroker.solar-calculator.svg)](https://david-dm.org/yourusername/iobroker.solar-calculator)
[![Known Vulnerabilities](https://snyk.io/test/github/yourusername/ioBroker.solar-calculator/badge.svg)](https://snyk.io/test/github/yourusername/ioBroker.solar-calculator)

## Solar Calculator Adapter für ioBroker

Dieser Adapter berechnet präzise Sonneneinstrahlung auf Solaranlagen unter Berücksichtigung von:
- Geografischer Position (Breitengrad/Längengrad)
- Dachausrichtung und -neigung
- Maximalem Einstrahlwinkel
- Sommer-/Winterzeit (automatische Umstellung)

### Funktionen

- **Echtzeitberechnung**: Aktuelle Sonneneinstrahlung alle 5 Minuten
- **Tagesplanung**: Berechnung von Sonnenaufgang/Sonnenuntergang auf dem Dach
- **Effizienzberechnung**: Kosinus des Einstrahlwinkels als Effizienzmaß
- **Automatische Zeitumstellung**: Berücksichtigung von Sommer-/Winterzeit
- **Konfigurierbar**: Alle Parameter über ioBroker-Objekte einstellbar

### Installation

1. Adapter über ioBroker Admin installieren
2. Instanz erstellen
3. Konfiguration anpassen (siehe Konfiguration)

### Konfiguration

Der Adapter erstellt automatisch folgende Konfigurationsobjekte:

#### Standort
- **config.latitude**: Breitengrad (Standard: 53.55 für Hamburg)
- **config.longitude**: Längengrad (Standard: 10.0 für Hamburg)

#### Dach-Parameter
- **config.roofAzimuth**: Dachausrichtung in Grad
  - 0° = Norden
  - 90° = Osten  
  - 180° = Süden (optimal)
  - 270° = Westen

- **config.roofTilt**: Dachneigung in Grad
  - 0° = flach
  - 30-40° = optimal für Deutschland
  - 90° = vertikal

- **config.maxIncidenceAngle**: Maximaler Einstrahlwinkel
  - 0° = nur senkrechte Einstrahlung
  - 60° = empfohlen für optimale Effizienz
  - 90° = auch parallele Einstrahlung

### Ausgabe-Objekte

#### Aktuelle Werte (current.*)
- **current.sunOnRoof**: Scheint die Sonne aktuell auf das Dach? (boolean)
- **current.sunElevation**: Aktuelle Sonnenhöhe in Grad
- **current.sunAzimuth**: Aktueller Sonnenazimut in Grad
- **current.incidenceAngle**: Aktueller Einstrahlwinkel auf das Dach
- **current.cosIncidence**: Kosinus des Einstrahlwinkels (Effizienzmaß 0-1)

#### Tageswerte (today.*)
- **today.firstSun**: Erste Sonneneinstrahlung heute (HH:MM)
- **today.lastSun**: Letzte Sonneneinstrahlung heute (HH:MM)
- **today.sunDuration**: Gesamte Sonnenscheindauer in Stunden
- **today.maxEfficiency**: Maximale Effizienz heute (0-1)
- **today.maxEfficiencyTime**: Uhrzeit der maximalen Effizienz

### Beispiel für Hamburg, Schafstrift 8b

```javascript
// Konfiguration für Hamburg
config.latitude = 53.55;
config.longitude = 10.0;
config.roofAzimuth = 180;  // Süd-Ausrichtung
config.roofTilt = 30;      // 30° Dachneigung
config.maxIncidenceAngle = 60;  // Max. 60° Einstrahlwinkel
```

### Sommer-/Winterzeit

Der Adapter berücksichtigt automatisch die deutsche Zeitumstellung:
- **Sommerzeit**: Letzter Sonntag im März bis letzter Sonntag im Oktober (UTC+2)
- **Winterzeit**: Letzter Sonntag im Oktober bis letzter Sonntag im März (UTC+1)

### Verwendung in Skripten

```javascript
// Prüfe ob Sonne auf Dach scheint
const sunOnRoof = getState('solar-calculator.0.current.sunOnRoof').val;

// Hole heutige Sonnenstunden
const sunDuration = getState('solar-calculator.0.today.sunDuration').val;

// Berechne Solarertrag basierend auf Effizienz
const efficiency = getState('solar-calculator.0.current.cosIncidence').val;
const maxPower = 5000; // 5kW Anlage
const currentPower = sunOnRoof ? maxPower * efficiency : 0;
```

### Visualisierung

Die Werte