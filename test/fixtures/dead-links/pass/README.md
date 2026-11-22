# Links that resolve

See the [guide](docs/guide.md), its [section](docs/guide.md#setup), the [docs folder](docs/), the [site](https://example.com), the [top](#links-that-resolve) and [mail](mailto:team@example.com).

A [reference link][guide] resolves too, and so does the [repo root](./).

Code is not a link: `[x](missing.md)`.

```md
[x](missing.md)
```

[guide]: docs/guide.md

A path with a space resolves: [spaced](<docs/my guide.md>).

A [help](//example.com/help) link, a [paren](docs/guide(v2).md) path and [a [nested] label](docs/guide.md).

Code with a backtick: `` `[x](missing.md)` ``.

A footnote[^1] resolves.

[^1]: See the docs.
[spaced]: <docs/my guide.md>

````md
```
[x](missing.md)
```
````
