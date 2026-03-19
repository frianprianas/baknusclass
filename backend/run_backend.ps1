Stop-Process -Name java, mvn, cmd -ErrorAction SilentlyContinue
Start-Sleep -s 1
$env:SPRING_PROFILES_ACTIVE='local'
$env:DB_USERNAME='sys as sysdba'
$env:DB_PASSWORD='on5laught'
.\maven-bin\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
