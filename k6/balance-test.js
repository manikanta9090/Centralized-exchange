import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
    vus: 25,
    duration: "10s",
};

export default function() {
    const token = __ENV.AUTH_TOKEN;

    const response = http.get(
        "http://localhost:3000/balance?asset=USD", {
            headers: {
                Authorization: `Bearer ${"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIyNDYzNDUxZi02NzJkLTQxZWItYmJkZS01MDA3ZGRjMDFhNWQiLCJpYXQiOjE3ODY1NTA4NjksImV4cCI6MTc4NzE1NTY2OX0.VxdVO-v3sYe4VaF8j-bv7LOVutCoB1kS702zuPl6p8g"}`,
            },
        },
    );

    check(response, {
        "status is 200": (r) => r.status === 200,
    });

    sleep(1);
}