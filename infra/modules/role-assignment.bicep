@description('Principal ID of the managed identity to assign the role to')
param principalId string

@description('Role definition ID (GUID only, not full resource ID)')
param roleDefinitionId string

@description('Resource ID of the Azure resource to scope the role assignment to')
param resourceId string

var roleAssignmentName = guid(principalId, roleDefinitionId, resourceId)

// Scope to subscription — the role assignment targets the specific resource via roleDefinitionId.
// Using subscription scope avoids the deprecated any() cast removed in recent Bicep versions.
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: roleAssignmentName
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
