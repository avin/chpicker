# Chpicker

Автоматическое создание cherry-pick pull-request-ов в релизные ветки + подливка master в ветку PR.

## Установка

```sh
npm install -g @avinlab/chpicker
```

## Настройка токена

Токен Bitbucket нужен для работы с pull-request-ами.

```sh
chpicker --bbtoken YOUR_TOKEN
```

Токен сохраняется в `~/.chpicker/config.json`.

## Запуск

Cherry-pick по ссылке на коммит:

```sh
chpicker <BITBUCKET_COMMIT_URL> <RELEASE_VERSION>
```

Например:

```sh
chpicker https://mybitbucker.com/projects/PROJECT/repos/REPO/commits/482849e20d594598e953edee145d54779e15c0dc 1.101
```

Создаётся pull-request через API, затем открывается его страница в браузере.

## Подливка master в ветку PR

```sh
chpicker https://mybitbucker.com/projects/PROJECT/repos/REPO/pull-requests/1046/overview
```

По ссылке на pull-request будет выполнен merge из `master` в ветку PR.

## Прокси для HTTP запросов

В `~/.chpicker/config.json` можно указать прокси:

```json
{
  "bbToken": "TOKEN",
  "proxy": "http://user:pass@proxy.company.local:8080"
}
```

## Временные директории

Временные репозитории создаются в `~/.chpicker/work`.
Для каждого запуска используется отдельная уникальная папка вида `<repo>-<random>`, что исключает коллизии при параллельных запусках.
