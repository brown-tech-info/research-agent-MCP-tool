@description('Principal ID of the managed identity to assign the role to')
param principalId string

@description('Role definition ID (GUID only, not full resource ID)')
param roleDefinitionId string

@description('Resource ID of the Azure resource to scope the role assignment to')
param resourceId string

var roleAssignmentName = guid(principalId, roleDefinitionId, resourceId)

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName
  scope: any(resourceId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
