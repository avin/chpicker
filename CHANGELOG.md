# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/),
и проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## v0.2.0
### Добавлено
- Сохранение токена Bitbucket через `--bbtoken` в `~/.chpicker/config.json`.
- Подливка `master` в ветку PR по ссылке на pull-request.
- Создание pull-request через Bitbucket API и открытие созданного PR в браузере.
- Поддержка HTTP/HTTPS прокси для API-запросов.
- Вывод выполненных git-команд при ошибках.
- Автоочистка рабочих каталогов в `~/.chpicker/work` при ошибках и сигналах.

### Изменено
- Временные репозитории создаются в `~/.chpicker/work`.

