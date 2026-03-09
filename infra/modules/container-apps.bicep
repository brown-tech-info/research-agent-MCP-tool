param location string
param tags object
param containerAppsEnvironmentName string
param containerAppName string
param containerRegistryName string
param logAnalyticsWorkspaceId string
param applicationInsightsConnectionString string

param azureOpenAiEndpoint string
@secure()
param azureOpenAiKey string
param azureOpenAiDeployment string
param azureOpenAiApiVersion string
@secure()
param bingSearchApiKey string

@description('Allowed CORS origin for the frontend (e.g. https://stapp-xxxxx.azurestaticapps.net)')
param corsOrigin string = 'http://localhost:5173'

@description('Container image to deploy (updated by azd on each deployment)')
param containerImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource environment 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(logAnalyticsWorkspaceId, '2022-10-01').customerId
        sharedKey: listKeys(logAnalyticsWorkspaceId, '2022-10-01').primarySharedKey
      }
    }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: containerAppName
  location: location
  tags: union(tags, { 'azd-service-name': 'orchestrator' })
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3001
        transport: 'http'
        corsPolicy: {
          allowedOrigins: [corsOrigin, 'http://localhost:5173']
          allowedMethods: ['GET', 'POST', 'DELETE', 'OPTIONS']
          allowedHeaders: ['Content-Type', 'Authorization']
          allowCredentials: false
        }
      }
      registries: [
        {
          server: '${containerRegistryName}.azurecr.io'
          username: listCredentials(
            resourceId('Microsoft.ContainerRegistry/registries', containerRegistryName),
            '2023-01-01-preview'
          ).username
          passwordSecretRef: 'registry-password'
        }
      ]
      secrets: [
        {
          name: 'registry-password'
          value: listCredentials(
            resourceId('Microsoft.ContainerRegistry/registries', containerRegistryName),
            '2023-01-01-preview'
          ).passwords[0].value
        }
        {
          name: 'azure-openai-key'
          value: azureOpenAiKey
        }
        {
          name: 'bing-search-api-key'
          value: bingSearchApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          image: containerImage
          name: 'orchestrator'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'AZURE_OPENAI_ENDPOINT'
              value: azureOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_KEY'
              secretRef: 'azure-openai-key'
            }
            {
              name: 'AZURE_OPENAI_DEPLOYMENT'
              value: azureOpenAiDeployment
            }
            {
              name: 'AZURE_OPENAI_API_VERSION'
              value: azureOpenAiApiVersion
            }
            {
              name: 'BING_SEARCH_API_KEY'
              secretRef: 'bing-search-api-key'
            }
            {
              name: 'CORS_ORIGIN'
              value: corsOrigin
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsightsConnectionString
            }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '10'
              }
            }
          }
        ]
      }
    }
  }
}

output containerAppUri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output containerAppName string = containerApp.name
