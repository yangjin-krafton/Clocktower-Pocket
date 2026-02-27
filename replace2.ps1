Get-ChildItem -Recurse -Path 'd:\Weeks\Clocktower-Pocket\src' -Include '*.js','*.md' | ForEach-Object {
  $c = Get-Content $_.FullName -Raw -Encoding UTF8
  if ($c -match '데몬') {
    $c = $c -replace '데몬','임프'
    Set-Content $_.FullName -Value $c -Encoding UTF8 -NoNewline
    Write-Host ('DM: ' + $_.Name)
  }
}
