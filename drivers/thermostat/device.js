'use strict';

const Homey = require('homey');

class ThermostatDevice extends Homey.Device {
  async onInit() {
    this.client = this.homey.app.createClient();
    this.devId = this.getData().id;

    this.log(`Init HJM thermostat devId=${this.devId} (fixed htr/2)`);

    // On-demand refresh button capability
    this.registerCapabilityListener('button.refresh', async () => {
      await this.refreshNow();
    });

    // Change setpoint (manual mode only)
    this.registerCapabilityListener('target_temperature', async (value) => {
      await this._setTargetTemperature(value);
      await this.refreshNow();
    });

    // Change mode
    this.registerCapabilityListener('thermostat_mode', async (value) => {
      await this._setMode(value);
      await this.refreshNow();
    });

    // Initial refresh only (no polling)
    await this.refreshNow();
  }

  // Public: refresh on demand
  async refreshNow() {
    await this._refresh();
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
