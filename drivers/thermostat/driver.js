'use strict';

const Homey = require('homey');

class ThermostatDriver extends Homey.Driver {

  onInit() {
    super.onInit();

    this.log('Thermostat driver initialized');

    // Refresh action
    const refreshCard = new Homey.FlowCardAction('refresh_device');
    refreshCard.register().registerRunListener((args, callback) => {
      args.device.refreshNow()
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });

    // Set mode
    const modeCard = new Homey.FlowCardAction('set_mode');
    modeCard.register().registerRunListener((args, callback) => {
      args.device.setModeFromFlow(args.mode)
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });

    // Set temperature
    const tempCard = new Homey.FlowCardAction('set_temperature');
    tempCard.register().registerRunListener((args, callback) => {
      args.device.setTemperatureFromFlow(args.temperature)
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });
  }

  onPair(socket) {
    this.log('Thermostat pairing has started...');
    const self = this;

    socket.on('list_devices', (data, callback) => {
      // Direct call to ensure context
      self.onPairListDevices(data, callback);
    });
  }

  async onPairListDevices(data, callback) {
    this.log('onPairListDevices called');

    try {
      // FAIL-SAFE: If this.homey is missing, check the global Homey object
      // Some SDK2 environments prefer the global reference during pairing
      const homeyRef = this.homey || Homey; 
      
      let app = homeyRef.app;

      if (!app) {
        this.log('App not found on instance, searching system...');
        // In SDK2, you can sometimes find the app via the Manager
        app = Homey.ManagerApps.getApp('be.vervondel.hjm-api'); 
      }

      if (!app) {
        // Last ditch effort: wait for the race condition
        await new Promise(resolve => setTimeout(resolve, 1500));
        app = this.homey ? this.homey.app : null;
      }

      if (!app || typeof app.createClient !== 'function') {
        throw new Error('App instance or createClient not available. Please restart the app.');
      }

      const client = app.createClient();
      const groups = await client.getGroupedDevs();
      
      const devices = (groups || []).flatMap(g => 
        (g.devs || []).map(d => ({
          name: `${g.name} • ${d.name}`,
          data: { id: String(d.dev_id) },
          store: {
            groupId: g.id,
            groupName: g.name,
            productId: d.product_id,
            fwVersion: d.fw_version,
            serialId: d.serial_id,
          },
        }))
      );

      callback(null, devices);

    } catch (err) {
      this.error('Pairing Error:', err.message);
      callback(err);
    }
  }}

module.exports = ThermostatDriver;