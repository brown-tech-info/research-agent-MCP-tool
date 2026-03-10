param location string
param tags object
param accountName string
param databaseName string = 'research-agent'
param containerName string = 'memory-entries'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    // Serverless — no provisioned throughput, pay per request
    capabilities: [{ name: 'EnableServerless' }]
    // Disable key-based auth — enforce managed identity / AAD only
    disableLocalAuth: true
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    enableAutomaticFailover: false
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-11-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: { id: databaseName }
  }
}

resource cosmosContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-11-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
      }
    }
  }
}

output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosAccountId string = cosmosAccount.id
output cosmosAccountName string = cosmosAccount.name
