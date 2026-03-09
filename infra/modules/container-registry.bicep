param location string
param tags object
param name string

resource registry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: true
    anonymousPullEnabled: false
  }
}

output name string = registry.name
output loginServer string = registry.properties.loginServer
output id string = registry.id
