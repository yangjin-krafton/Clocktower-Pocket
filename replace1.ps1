Get-ChildItem -Recurse -Path 'd:\Weeks\Clocktower-Pocket\src' -Include '*.js','*.md' | ForEach-Object {
  $c = Get-Content $_.FullName -Raw -Encoding UTF8
  if ($c -match '스토리텔러') {
    $c = $c -replace '스토리텔러','이야기꾼'
    Set-Content $_.FullName -Value $c -Encoding UTF8 -NoNewline
    Write-Host ('ST: ' + $_.Name)
  }
}
