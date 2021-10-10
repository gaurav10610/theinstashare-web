// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.

export const environment = {
  is_native_app: false,
  production: false,
  api_endpoint_base: 'http://localhost:9191/instashare/users/',
  api_media_server_base: 'http://localhost:9696/instashare/media-server/',
  rtc_api_endpoint_base: 'http://localhost:9090'
};
