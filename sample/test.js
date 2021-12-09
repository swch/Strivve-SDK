const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const HttpsProxyAgent = require("https-proxy-agent");

(async () => {

try {
    const proxy_url = `http://lum-customer-c_03040dc2-zone-residential_test_zone-session-rand633-country-us:khf3z4wdc3zf@zproxy.lum-superproxy.io:22225`;
    const agent = new HttpsProxyAgent(proxy_url);
    const ip_data_response = await fetch("https://lumtest.com/myip.json", {
        agent 
    });
    console.log(await ip_data_response.text());
} catch (err) {
    console.log(err);
}

})();