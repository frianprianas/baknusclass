Stop-Process -Name java, mvn, cmd -ErrorAction SilentlyContinue
Start-Sleep -s 1
$env:SPRING_PROFILES_ACTIVE='local'
$env:DB_USERNAME='SYSTEM'
$env:DB_PASSWORD='on5laught'
$env:DB_URL='jdbc:oracle:thin:@127.0.0.1:1521/BAKNUSDB'
$env:REDIS_HOST='127.0.0.1'
$env:REDIS_PORT='6380'
$env:REDIS_PASSWORD='on5laught'
.\maven-bin\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
