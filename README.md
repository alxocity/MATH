# MATH

Metadata is on chain. The originals return an empty `tokenURI`. OpenSea still requests the Azure URLs, which read `tokenJSON` from the renderers.

- MATH `0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D`, renderer `0xb3cA13A2722CAB48c8d9068bD67656efe2d5e376`
- RGB `0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956`, renderer `0x62FFe75cd9824A2e8855CbC055256De229B5b936`
- TOON `0x026A7D72a448D0E44d441e55F746BF56B843aEDB`, renderer `0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb`

The Function app has to be Azure Functions v4 on Node >= 18. `package.json` sets that engine because the proxy uses global `fetch`. `.vscode/settings.json` sets `azureFunctions.projectRuntime` to `~4`.

Find the resource group, then check. `FUNCTIONS_EXTENSION_VERSION` is `~4`. Node is `~18` or newer: `WEBSITE_NODE_DEFAULT_VERSION` on Windows, `linuxFxVersion` of `Node|18` on Linux.

```shell
az functionapp list --query "[?defaultHostName=='alxo.azurewebsites.net'].resourceGroup" -o tsv
az functionapp config appsettings list --name alxo --resource-group $RG --query "[?name=='FUNCTIONS_EXTENSION_VERSION' || name=='WEBSITE_NODE_DEFAULT_VERSION'].{name:name,value:value}" -o table
az functionapp config show --name alxo --resource-group $RG --query linuxFxVersion -o tsv
```

Set it:

```shell
az functionapp config appsettings set --name alxo --resource-group $RG --settings FUNCTIONS_EXTENSION_VERSION=~4 WEBSITE_NODE_DEFAULT_VERSION=~18
az functionapp config set --name alxo --resource-group $RG --linux-fx-version "Node|18"
```

In the portal: Configuration, Function runtime settings, Runtime version `~4`, then General settings, Node `18` or newer.
