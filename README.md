# Chpicker

Автоматическое создание cherry-pick pull-request-ов в релизные ветки

## Установка

```sh
npm install -g chpicker
```

## Запусе

```sh
chpicker <BITBUCKET_COMMIT_URL> <RELEASE_VERSION>
```

Например:

```sh
chpicker https://mybitbucker.com/projects/PROJECT/repos/REPO/commits/482849e20d594598e953edee145d54779e15c0dc 1.284
```