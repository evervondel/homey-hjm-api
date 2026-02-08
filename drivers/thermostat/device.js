'use strict';

const Homey = require('homey');

class ThermostatDevice extends Homey.Device {
  async onInit() {
    this.client = this.homey.app.createClient();
    this.devId = this.getData().id;

    this.log(`Init HJM thermostat devId=${this.devId} (fixed htr/2)`);

    this._pollTimer = null;
    this._pollIntervalMs = null;

    // On-demand refresh button capability
    this.registerCapabilityListener('button.refresh', async () => {
      await this.refreshNow();
      return true;
    });

    // Change setpoint (manual mode only)
    this.registerCapabilityListener('target_temperature', async (value) => {
      await this._setTargetTemperature(value);
      await this.refreshNow();
      return true;
    });

    // Change mode
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      await this._setMode(value);
      await this.refreshNow();
      return true;
    });

    // Initial refresh only (no polling)
    await this.refreshNow();

    this._setupPollingFromSettings();
    this.on('settings', (newSettings) => this._setupPollingFromSettings(newSettings));
    // Lifecycle handlers: ensure polling stops immediately on device uninit/delete
    this.on('uninit', () => this._stopPolling());
    this.on('deleted', () => this._stopPolling());
    // Ensure immediate handling for settings changes (SDK compatibility)
    if (typeof this.onSettings !== 'function') {
      this.onSettings = (newSettings) => this._setupPollingFromSettings(newSettings);
    }
  }

  

  // Public: refresh on demand
  async refreshNow() {
    await this._refresh();
  }

  _setupPollingFromSettings(settings) {
    try {
      const s = settings || (typeof this.getSettings === 'function' ? this.getSettings() : {}) || {};
      const enabled = !!s.pollingEnabled;
      let interval = Number(s.pollingInterval || 0) || 30;
      if (interval < 20) interval = 20;
      const intervalMs = Math.max(20000, Math.round(interval) * 1000);

      if (enabled) {
        if (this._pollTimer && this._pollIntervalMs === intervalMs) return;
        this._startPolling(intervalMs);
      } else {
        this._stopPolling();
      }
    } catch (err) {
      this.error(err);
    }
  }

  _startPolling(intervalMs) {
    this._stopPolling();
    this._pollIntervalMs = intervalMs;
    this.log(`Starting polling every ${Math.round(intervalMs/1000)}s`);
    this._pollTimer = setInterval(() => {
      this.refreshNow().catch(err => this.error(err));
    }, intervalMs);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      this.log('Stopped polling');
    }
    this._pollIntervalMs = null;
  }

  // Public: Flow action helpers
  async setModeFromFlow(mode) {
    await this._setMode(mode);
    await this.refreshNow();
  }

  async setTemperatureFromFlow(temperature) {
    await this._setTargetTemperature(temperature);
    await this.refreshNow();
  }

  // Helpers
  _toFloat(x) {
    if (x === null || x === undefined) return null;
    const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  _normalizeMode(mode) {
    if (mode === 'off' || mode === 'manual' || mode === 'auto') return mode;
    return 'auto';
  }

  async _getStatus() {
    return this.client.getHtr2Status(this.devId);
  }

  async _postStatus(payload) {
    return this.client.setHtr2Status(this.devId, payload);
  }

  async _setTargetTemperature(target) {
    const current = await this._getStatus();

    // Only allow setting the temperature when the device is in manual mode
    const currentMode = this._normalizeMode(current.mode);
    if (currentMode !== 'manual') {
      throw new Error(this.homey.__('errors.temp_manual_only'));
    }

    const payload = {
      stemp: String(target),
      units: 'C',
      mode: 'manual'
    };

    await this._postStatus(payload);
    await this.setCapabilityValue('target_temperature', target);
  }

  async _setMode(mode) {
    const current = await this._getStatus();
    const apiMode = this._normalizeMode(mode);

    // Keep setpoint stable when switching modes
    const currentSet = this._toFloat(current.stemp);
    const fallbackSet = this.getCapabilityValue('target_temperature') ?? currentSet ?? 20;

    const payload = {
      mode: apiMode
    };

    await this._postStatus(payload);
    await this.setCapabilityValue('thermostat_mode', apiMode);
  }

  async _refresh() {
    const st = await this._getStatus();

    const mtemp = this._toFloat(st.mtemp);
    if (mtemp !== null) {
      await this.setCapabilityValue('measure_temperature', mtemp);
    }

    const stemp = this._toFloat(st.stemp);
    if (stemp !== null) {
      await this.setCapabilityValue('target_temperature', stemp);
    }

    if (typeof st.mode === 'string') {
      await this.setCapabilityValue('thermostat_mode', this._normalizeMode(st.mode));
    }

    await this.setAvailable().catch(this.error);
  }
}

module.exports = ThermostatDevice;
