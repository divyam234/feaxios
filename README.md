# feaxios

`feaxios` is a lightweight alternative to [Axios], providing the same familiar API with a significantly reduced footprint of **2kb**. It leverages the native `fetch()` API supported in all modern browsers, delivering a performant and minimalistic solution. This makes it an ideal choice for projects where minimizing bundle size is a priority.

### Key Features

- **Lightweight:** With a size of less than 1/5th of Axios, `feaxios` is an efficient choice for projects with strict size constraints.

- **Native Fetch API:** Utilizes the browser's native [Fetch API][fetch], ensuring broad compatibility and seamless integration with modern web development tools.

- **Interceptor Support:** `feaxios` supports interceptors, allowing you to customize and augment the request and response handling process.

- **Timeouts:** Easily configure timeouts for requests, ensuring your application remains responsive and resilient.

### When to Use feaxios

While [Axios] remains an excellent module, `feaxios` provides a compelling option in scenarios where minimizing dependencies is crucial. By offering a similar API to Axios, `feaxios` bridges the gap between Axios and the native `fetch()` API.

### Usage

```js
import axios from 'feaxios';

// Use 'feaxios' just like you would with Axios
axios.get('https://api.example.com/data')
  .then(response => {
    // Handle the response
    console.log(response.data);
  })
  .catch(error => {
    // Handle errors
    console.error(error);
  });
