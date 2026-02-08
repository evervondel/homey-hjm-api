'use strict';

const Homey = require('homey');

class ThermostatDriver extends Homey.Driver {

  onInit() {
    this.log('Thermostat driver initialized');

    // Refresh action
    const refreshCard = new Homey.FlowCardAction('refresh_device');
    refreshCard.register();
    refreshCard.registerRunListener((args, callback) => {
      args.device.refreshNow()
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });

    // Set mode
    const modeCard = new Homey.FlowCardAction('set_mode');
    modeCard.register();
    modeCard.registerRunListener((args, callback) => {
      args.device.setModeFromFlow(args.mode)
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });

    // Set temperature
    const tempCard = new Homey.FlowCardAction('set_temperature');
    tempCard.register();
    tempCard.registerRunListener((args, callback) => {
      args.device.setTemperatureFromFlow(args.temperature)
        .then(() => callback(null, true))
        .catch(err => callback(err));
    });
  }

  onPairListDevices(data, callback) {
    const client = this.homey.app.createClient();

    client.getGroupedDevs()
      .then(groups => {
        const devices = [];

        for (const g of (groups || [])) {
          for (const d of (g.devs || [])) {
            devices.push({
              name: `${g.name} • ${d.name}`,
              data: { id: String(d.dev_id) },
              store: {
                groupId: g.id,
                groupName: g.name,
                productId: d.product_id,
                fwVersion: d.fw_version,
                serialId: d.serial_id,
              },
            });
          }
        }

        callback(null, devices);
      })
      .catch(err => callback(err));
  }
}

module.exports = ThermostatDriver;