const axios = require('axios');
const { DateTime } = require('luxon');

require('dotenv').config()

async function getCountries() {
    const url = 'https://api.covid19api.com/countries';
    const response = await axios.get(url, {
        headers: {
            'X-Access-Token': process.env.COVID_API_KEY,
        },
    });
    const countries = response.data.map(entry => entry.Slug);
    console.log("Finished getting countries.")
    return countries;
}

async function getCovidStats(countryCode) {
    const from = '2020-03-01T00:00:00Z';
    const today = DateTime.local().toISODate();
    const to = `${today}T00:00:00Z`;
    const url = `https://api.covid19api.com/country/${countryCode}?from=${from}&to=${to}`;
    const response = await axios.get(url, {
        headers: {
            'X-Access-Token': process.env.COVID_API_KEY,
        },
    });
    console.log(`Finished getting data for ${countryCode}.`);
    return response.data;
}

async function writeDataToInfluxDB(data, country) {
    const host = process.env.INFLUXDB_HOST;
    const database = process.env.INFLUXDB_DATABASE;
    const token = process.env.INFLUXDB_TOKEN;
    const org = process.env.INFLUXDB_ORG;
    const url = `${host}/api/v2/write?bucket=${database}&org=${org}&precision=ms`;
    const headers = { Authorization: `Token ${token}` };
    const response = await axios.post(url, data, { headers });
    if (response.status === 204) {
        console.log(`Data successfully written to InfluxDB. ${country}`);
    } else {
        console.log(`Error writing to InfluxDB. ${country}`);
        console.log(response.data);
    }
}

async function processData() {
    const countries = await getCountries();

    for (const country of countries) {
        const covidStats = await getCovidStats(country);

        let data = '';
        for (const entry of covidStats) {
            const time = DateTime.fromISO(entry.Date);
            const msTime = time.toMillis();
            data += `covid_19,country_code=${entry.CountryCode}`;
            data += ` country_name="${entry.Country}"`;
            data += `,lat=${entry.Lat}`;
            data += `,lon=${entry.Lon}`;
            data += `,confirmed=${entry.Confirmed}`;
            data += `,deaths=${entry.Deaths}`;
            data += `,recovered=${entry.Recovered}`;
            data += `,active=${entry.Active}`;
            data += ` ${msTime}\n`;
        }

        await writeDataToInfluxDB(data, country);
    }
}

processData();