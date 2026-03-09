targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (used to generate unique resource names)')
param environmentName string

@minLength(1)
@description('Primary Azure region for all resources')
param location string = 'eastus'

@description('Azure OpenAI endpoint URL (e.g. https://your-resource.cognitiveservices.azure.com/)')
param azureOpenAiEndpoint string

@description('Azure OpenAI deployment name (e.g. gpt-4o)')
param azureOpenAiDeployment string = 'gpt-4o'

@description('Azure OpenAI API version')
param azureOpenAiApiVersion string = '2024-10-01-preview'

@description('Resource ID of the Azure OpenAI resource (for RBAC role assignment)')
param azureOpenAiResourceId string = ''

// ---------------------------------------------------------------------------
// Derived names
// ---------------------------------------------------------------------------

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = { 'azd-env-name': environmentName }

// Cognitive Services OpenAI User role — grants token-based access to Azure OpenAI
var cognitiveServicesOpenAiUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

// ---------------------------------------------------------------------------
// Resource group
// ---------------------------------------------------------------------------

resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

// ---------------------------------------------------------------------------
// Monitoring (App Insights + Log Analytics)
// ---------------------------------------------------------------------------

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    tags: tags
    logAnalyticsName: '${abbrs.operationalInsightsWorkspaces}${resourceToken}'
    applicationInsightsName: '${abbrs.insightsComponents}${resourceToken}'
  }
}

// ---------------------------------------------------------------------------
// Container Registry
// ---------------------------------------------------------------------------

module registry './modules/container-registry.bicep' = {
  name: 'registry'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.containerRegistryRegistries}${resourceToken}'
  }
}

// ---------------------------------------------------------------------------
// Static Web App (frontend) — provisioned before Container Apps so we have the URL for CORS
// ---------------------------------------------------------------------------

module staticWebApp './modules/static-web-app.bicep' = {
  name: 'static-web-app'
  scope: rg
  params: {
    location: location
    tags: tags
    name: '${abbrs.webStaticSites}${resourceToken}'
  }
}

// ---------------------------------------------------------------------------
// Container Apps (orchestrator) — CORS wired to SWA URL in one pass
// ---------------------------------------------------------------------------

module containerApps './modules/container-apps.bicep' = {
  name: 'container-apps'
  scope: rg
  params: {
    location: location
    tags: tags
    containerAppsEnvironmentName: '${abbrs.appManagedEnvironments}${resourceToken}'
    containerAppName: '${abbrs.appContainerApps}${resourceToken}'
    containerRegistryName: registry.outputs.name
    logAnalyticsWorkspaceId: monitoring.outputs.logAnalyticsWorkspaceId
    applicationInsightsConnectionString: monitoring.outputs.applicationInsightsConnectionString
    azureOpenAiEndpoint: azureOpenAiEndpoint
    azureOpenAiDeployment: azureOpenAiDeployment
    azureOpenAiApiVersion: azureOpenAiApiVersion
    corsOrigin: 'https://${staticWebApp.outputs.defaultHostname}'
  }
}

// ---------------------------------------------------------------------------
// RBAC — grant Container App managed identity access to Azure OpenAI
// Only assigned when azureOpenAiResourceId is provided
// ---------------------------------------------------------------------------

module openAiRoleAssignment './modules/role-assignment.bicep' = if (!empty(azureOpenAiResourceId)) {
  name: 'openai-role-assignment'
  scope: rg
  params: {
    principalId: containerApps.outputs.containerAppPrincipalId
    roleDefinitionId: cognitiveServicesOpenAiUserRoleId
    resourceId: azureOpenAiResourceId
  }
}

// ---------------------------------------------------------------------------
// Outputs (consumed by azd)
// ---------------------------------------------------------------------------

output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_CONTAINER_REGISTRY_NAME string = registry.outputs.name
output SERVICE_ORCHESTRATOR_URI string = containerApps.outputs.containerAppUri
output SERVICE_FRONTEND_STATIC_WEB_APP_NAME string = staticWebApp.outputs.name
output SERVICE_FRONTEND_URI string = 'https://${staticWebApp.outputs.defaultHostname}'
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString
output CONTAINER_APP_PRINCIPAL_ID string = containerApps.outputs.containerAppPrincipalId
output APPLICATIONINSIGHTS_CONNECTION_STRING string = monitoring.outputs.applicationInsightsConnectionString
