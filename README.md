# feaxios

![bundlejs](https://deno.bundlejs.com/badge?q=feaxios)

`feaxios` is a lightweight fetch-based HTTP client with an Axios-style API and optional plugins. It uses the native `fetch()` API available in modern runtimes and keeps the core entry small by moving extras like retry and logging into opt-in plugin paths.

### Key Features

- **Lightweight:** Small core bundle with optional plugin entrypoints.

- **Native Fetch API:** Utilizes the browser's native fetch, ensuring broad compatibility and seamless integration with modern web development tools.

- **Interceptor Support:** `feaxios` supports interceptors, allowing you to customize and augment the request and response handling process.

- **Timeouts:** Easily configure timeouts for requests, ensuring your application remains responsive and resilient.

- **Plugins:** Optional features like retry and logging can be installed with `client.use(...)`.

### When to Use feaxios

`feaxios` is useful when you want an Axios-like API on top of native `fetch()` without pulling a larger client into the main bundle.

### Plugins

Install optional features per client with `use()`:

```ts
import axios from "feaxios";
import cookieJar, { CookieJar } from "feaxios/cookie-jar";
import retry from "feaxios/retry";
import logger from "feaxios/logger";

const client = axios.create();

client.use(cookieJar, { jar: new CookieJar() });
client.use(retry, { retries: 3 });
client.use(logger, {
  onRequest: ({ method, url }) => console.log(method, url),
});
```

Available plugin entrypoints:

- `feaxios/retry`
- `feaxios/logger`
- `feaxios/cookie-jar`
- `feaxios/plugins`

For cookie jar behavior and advanced cookie handling rules, see `tough-cookie`:
https://github.com/salesforce/tough-cookie

```sh
bun add feaxios
```

For developing this repo:

```sh
bun install
bun run test
bun run build
```

**Request Config**

```ts
{
  url: "/user",
  method: "get",
  baseURL: "https://some-domain.com/api/",
  transformRequest: [(data, headers) => data],
  transformResponse: [(data) => data],
  headers: { test: "test" },
  params: { id: 12345 },
  paramsSerializer: (params) => new URLSearchParams(params).toString(),
  data: {},
  timeout: 1000,
  withCredentials: false,
  responseType: "json",
  validateStatus: (status) => status >= 200 && status < 300,
  signal: new AbortController().signal,
  fetchOptions: {
    redirect: "follow",
    agent: undefined,
    dispatcher: undefined,
  },
  retry: { retries: 3 },
}
```

`fetchOptions` can include runtime-specific options supported by your environment, such as Node/Bun `agent` or `dispatcher`.

### Usage

```js
import axios from "feaxios";

axios
  .get("https://api.example.com/data")
  .then((response) => {
    // Handle the response
    console.log(response.data);
  })
  .catch((error) => {
    // Handle errors
    console.error(error);
  });
```

**With Interceptors**

```js
import axios from "feaxios";

axios.interceptors.request.use((config) => {
  config.headers.set("Authorization", "Bearer *");
  return config;
});
axios.interceptors.response.use(
  function (response) {
    return response;
  },
  function (error) {
    //do something with error
    return Promise.reject(error);
  },
);
```

**With Plugins**

```ts
import axios from "feaxios";
import cookieJar, { CookieJar } from "feaxios/cookie-jar";
import retry from "feaxios/retry";
import logger from "feaxios/logger";

const http = axios.create({
  timeout: 3 * 1000 * 60,
});

http.use(cookieJar, { jar: new CookieJar() });
http.use(retry, { retryDelay: retry.exponentialDelay });
http.use(logger, {
  onRequest: ({ method, url }) => console.log("->", method, url),
  onResponse: ({ method, url, status, duration }) =>
    console.log("<-", method, url, status, `${duration.toFixed(1)}ms`),
  onError: ({ method, url, error }) => console.error("x", method, url, error),
});
```
