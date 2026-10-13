function Protect-MonoCodeDirectory([string] $Path) {
  $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'The host data directory must not be a link or junction.'
  }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  # Read only the existing DACL. Replacing a new descriptor with SetOwner
  # can require WRITE_OWNER even when this user already owns the directory.
  $owner = $item.GetAccessControl([Security.AccessControl.AccessControlSections]::Owner).GetOwner([Security.Principal.SecurityIdentifier])
  if ($owner.Value -ne $sid.Value) { throw 'The host data directory belongs to another user.' }
  $acl = $item.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($oldRule in @($acl.Access)) { $acl.RemoveAccessRuleSpecific($oldRule) }
  foreach ($identity in @($sid.Value, 'S-1-5-18', 'S-1-5-32-544')) {
    $principal = New-Object Security.Principal.SecurityIdentifier($identity)
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($principal, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  # Set-Acl rewrites every section, including the audit list, which needs
  # SeSecurityPrivilege. The scheduled task's limited token does not have it.
  $item.SetAccessControl($acl)
}
