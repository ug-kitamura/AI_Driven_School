param([string]$inputPath)
[Convert]::ToBase64String([IO.File]::ReadAllBytes($inputPath))
