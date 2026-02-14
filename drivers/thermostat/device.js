'use strict';

const Homey = require('homey');

class ThermostatDevice extends Homey.Device {
  async onInit() {
    super.onInit();

    // In SDK v2, the app instance is globally available at Homey.app 
    // or through the driver instance.
    let app = this.homey ? this.homey.app : Homey.app;

    if (!app || typeof app.createClient !== 'function') {
      this.error('App instance not ready, waiting 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Re-check after delay
      app = this.homey ? this.homey.app : Homey.app;
    }

    if (!app || typeof app.createClient !== 'function') {
      this.error('CRITICAL: Could not find app instance to create client.');
      return; // Stop initialization to prevent further crashes
    }

    this.client = app.createClient();
    this.devId = this.getData().id; 
    this.log(`Init HJM thermostat devId=${this.devId} (fixed htr/2)`);

    this._pollTimer = null;
    this._pollIntervalMs = null;

    // On-demand refresh button capability
    this.registerCapabilityListener('button.refresh', async () => {
      await this.refreshNow();
      return true;
    });

    // Change setpoint
    this.registerCapabilityListener('target_temperature', async (value) => {
      await this._setTargetTemperature(value);
      await this._wait(2000);
      await this.refreshNow();
      return true;
    });

    // Change mode
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      await this._setMode(value);
      await this._wait(2000);
      await this.refreshNow();
      return true;
    });

    // Initial refresh only (no polling)
    await this.refreshNow();

    this._setupPollingFromSettings();
  }

  async onSettings(oldSettings, newSettings, changedKeys) {
    this.log('Settings changed:', changedKeys);
    this._setupPollingFromSettings(newSettings);
    return true; // Confirms settings change in UI
  }

  // This is called when the app/driver is stopped or the device is disabled
  onUninit() {
    this.log('Device uninitializing, stopping polling...');
    this._stopPolling();
  }

  // This is called when the device is removed from Homey
  onDeleted() {
    this.log('Device deleted, stopping polling...');
    this._stopPolling();
  }

  _setupPollingFromSettings(settings) {
    try {
      // Use passed settings (from onSettings) OR current settings (from onInit)
      const s = settings || this.getSettings();
      
      // Explicitly check for true/false
      const enabled = s.pollingEnabled === true;
      let interval = Number(s.pollingInterval) || 30;
      if (interval < 30) interval = 30;
      const intervalMs = interval * 1000;

      this.log(`Polling Setup: Enabled=${enabled}, Interval=${interval}s`);

      if (enabled) {
        // Don't restart if nothing changed
        if (this._pollTimer && this._pollIntervalMs === intervalMs) {
          this.log('Polling already running with same interval, skipping restart.');
          return;
        }
        this._startPolling(intervalMs);
      } else {
        this.log('Polling should be disabled. Stopping timer.');
        this._stopPolling();
      }
    } catch (err) {
      this.error('Error in setupPolling:', err);
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

  // Public: refresh on demand
  async refreshNow() {
    await this._refresh();
  }


  // Public: Flow action helpers
  async setModeFromFlow(mode) {
    await this._setMode(mode);
    await this._wait(2000);
    await this.refreshNow();
  }

  async setTemperatureFromFlow(temperature) {
    await this._setTargetTemperature(temperature);
    await this._wait(2000);
    await this.refreshNow();
  }

  // Helpers
  _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _toFloat(x) {
    if (x === null || x === undefined) return null;
    const n = typeof x === 'number' ? x : parseFloat(String(x).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  _normalizeMode(mode) {
    // Map API 'manual' to Homey 'heat' for UI compatibility
    if (mode === 'manual' || mode === 'heat') return 'heat';
    if (mode === 'off' || mode === 'auto') return mode;
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

    // Only allow setting the temperature when the device is in manual (heat) mode
    const currentMode = this._normalizeMode(current.mode);
    if (currentMode !== 'heat') {
      throw new Error(Homey.__('errors.temp_manual_only'));
    }

    const payload = {
      stemp: String(target),
      units: 'C',
      mode: 'manual'
    };

    await this._postStatus(payload);
  }

  async _setMode(mode) {

    // Map Homey to API modes:
    // 'heat' (Homey) -> 'manual' (API)
    // 'off' (Homey) -> 'off' (API)
    // 'auto' (Homey) -> 'auto' (API)
    const apiMode = (mode === 'heat' ? 'manual' : (mode === 'off' || mode === 'auto' ? mode : 'auto'));

    const payload = {
      mode: apiMode
    };

    await this._postStatus(payload);
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
