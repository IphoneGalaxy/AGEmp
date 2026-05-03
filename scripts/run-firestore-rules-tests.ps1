# Executa Vitest contra o Emulator Firestore (rules-unit-testing precisa FIRESTORE_EMULATOR_HOST).
# Requer JDK 21+ instalado — o firebase-tools cortou Java < 21.
# Uso na raiz do repo:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-firestore-rules-tests.ps1

$ErrorActionPreference = "Stop"

function Find-Jdk21Home {
  $roots = @(
    "${env:ProgramFiles}\Eclipse Adoptium",
    "${env:ProgramFiles}\Microsoft",
    "${env:ProgramFiles}\Java",
    "${env:LocalAppData}\Programs\Eclipse Adoptium"
  )
  foreach ($r in $roots) {
    if (-not (Test-Path $r)) { continue }
    $dir = Get-ChildItem $r -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^jdk-21' -or $_.Name -match 'jdk-21' } |
      Sort-Object Name -Descending |
      Select-Object -First 1
    if ($dir) {
      return $dir.FullName
    }
  }
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    try {
      $v = & "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | Out-String
      if ($v -match 'version "(2[1-9]|[3-9][0-9])') {
        return $env:JAVA_HOME
      }
    } catch {}
  }
  return $null
}

$jdk = Find-Jdk21Home
if (-not $jdk) {
  Write-Host ""
  Write-Host "Nenhum JDK 21+ encontrado nos caminhos comuns nem JAVA_HOME válido." -ForegroundColor Red
  Write-Host "Instale, por exemplo, Eclipse Temurin 21 (MSI):" -ForegroundColor Yellow
  Write-Host "  https://adoptium.net/temurin/releases/?version=21&os=windows&arch=x64&package=jdk"
  Write-Host ""
  Write-Host "Ou, com Chocolatey em PowerShell **como Administrador**:" -ForegroundColor Yellow
  Write-Host "  choco install Temurin21 -y"
  Write-Host ""
  exit 2
}

$env:JAVA_HOME = $jdk
$env:Path = "$jdk\bin;$env:Path"

Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Cyan
# `java -version` escreve em stderr; com $ErrorActionPreference Stop o PowerShell 7 trataria como erro fatal.
$_prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
  cmd /c "java -version 2>&1"
} finally {
  $ErrorActionPreference = $_prevEap
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $repoRoot

try {
  # Emulators só aceitam emulador oficial; comando único igual ao npm script anterior.
  npx -y firebase-tools@latest emulators:exec --only firestore "npx vitest run src/firebase/__tests__/loanRequestsCreate.rules.test.js src/firebase/__tests__/loanRequestsCounteroffer.rules.test.js"
} finally {
  Pop-Location
}
