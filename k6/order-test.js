import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    vus: 5,
    duration: "10s",
};

export default function() {
    const url = "http://localhost:3000/order";

    const payload = JSON.stringify({
        market: "SOL_USD",
        side: "BUY",
        price: 90,
        quantity: 2,
    });

    const params = {
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNDYzNDUxZi02NzJkLTQxZWItYmJkZS01MDA3ZGRjMDFhNWQiLCJpYXQiOjE3ODY1NTA4NjksImV4cCI6MTc4NzE1NTY2OX0.VxdVO-v3sYe4VaF8j-bv7LOVutCoB1kS702zuPl6p8g",
        },
    };

    const res = http.post(url, payload, params);

    console.log(`Status: ${res.status}`);
    console.log(`Response: ${res.body}`);

    check(res, {
        "status is 200": (r) => r.status === 200,
    });

    sleep(1);
}