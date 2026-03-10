param staticWebAppName string
param containerAppResourceId string
param location string

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' existing = {
  name: staticWebAppName
}

// Links the Container App as the /api/* backend for the Static Web App.
// Requests to /api/* from the SWA are proxied to the Container App at the same path.
resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2022-09-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: containerAppResourceId
    region: location
  }
}
