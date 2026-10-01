# Renderer

On-chain metadata for the frozen [MATH](https://etherscan.io/address/0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D), [RGB](https://etherscan.io/address/0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956) and [TOON](https://etherscan.io/address/0x026A7D72a448D0E44d441e55F746BF56B843aEDB) contracts. Those contracts stay as they are: `tokenURI` on each one returns `""`, and there is no setter, owner, or proxy to change that.

This is the minimum viable way to put the art and metadata on chain as well. `tokenURI(uint256)` returns `data:application/json;base64,...` with an inline base64 SVG. A bug is fixed by deploying a new renderer and repointing, not by an admin key.

## Why three contracts

`src/Render.sol` is one file. It deploys as three contracts, `MATHRender`, `RGBRender` and `TOONRender`, each with `tokenURI(uint256)`.

OnChainChecker, wallets and a later OpenSea repoint all call `tokenURI` on an address. One contract cannot expose three different `tokenURI` functions. The shared encoder lives in a base contract so the source is not copied; each deployment only carries what it uses. Nothing here is owned, upgradeable, or proxied, and a render reads only the original contracts (plus WORD and ChainFaces, which TOON already reads).

## Gas

Measured with `forge test --match-test test_gas -vv` on a mainnet fork at block 26,098,697. The figure is `tokenURI`'s frame gas, which is what `eth_call` spends.

| Call | Gas |
| --- | ---: |
| `MATHRender.tokenURI(1)` | 431,349 |
| `RGBRender.tokenURI(100)` | 4,457,056 |
| `TOONRender.tokenURI(1973)` | 4,415,431 |

The 16×16 bitmap is the expensive part. It is the same string of `<rect>` nodes as the Azure functions, written into one buffer, then base64'd in assembly. A plain Solidity base64 loop was about 23M gas. These calls sit well under typical `eth_call` caps.

Estimated deployment gas is one transaction per contract: 21,000 plus calldata plus the create frame (code deposit included). From `test_deploy_gas`:

| Contract | Runtime bytes | Deploy gas |
| --- | ---: | ---: |
| `MATHRender` | 5,126 | 1,264,469 |
| `RGBRender` | 3,122 | 799,437 |
| `TOONRender` | 5,978 | 1,462,791 |
| All three | | 3,526,697 |

## Usage

```shell
cd renderer
forge test
```

Fork tests use `MAINNET_RPC_URL`, or `https://ethereum.publicnode.com` if that is unset. No key is required. `ffi` is enabled in `foundry.toml` because the tests decode the data URI in Python and compare it to the Azure snapshots in `test/fixtures/`.

```shell
forge test --match-contract MathTest
forge test --match-test test_gas -vv
```

Deploy, when you mean to, with your own key. This repo does not contain one, and this script has not been broadcast:

```shell
forge script script/Deploy.sol --rpc-url https://ethereum.publicnode.com --private-key $KEY --broadcast
```

After deploy, call `tokenURI` on each renderer with a minted id. Write the three addresses into the root README at that point.

## Differences from Azure

The snapshots are the live Azure bodies (`/api/math`, `/api/RGB`, `/api/TOON`). Parsed image, name and traits match, except:

- The outer return is a base64 JSON data URI. Azure serves a JSON object whose picture is raw SVG in `image_data`. Here the picture is `image` = `data:image/svg+xml;base64,...`. The decoded SVG matches `image_data` byte for byte on the fixtures.
- `external_url` is left out. It is an Etherscan link, not part of the token.
- MATH's description keeps the `0x` hex and the 16×16 ⬛/⬜ bitmap. The UTF-8, UTF-16 and UTF-32 readings of that hex are left out.
- `digit_mean` is rounded to 6 decimal places. Terminating values match (`1`, `7.5`, `9`). Repeating ones differ in the tail: Azure's `0.6666666666666666` is `0.666667`, and `0.05263157894736842` is `0.052632`.
- JSON is compact. Key order is not the Azure order. Decoded fields are what the tests compare.
- A face or word that contains `&`, `<`, `>` or quotes is escaped. None of the sampled tokens need it, so those SVGs still match.

TOON's text colour follows the Azure expression `Number(color - 5).toString(16).padStart(6, "0")`, including the odd cases that function actually produces: `"0000-5"` when the colour is 0, and a 65-digit hex string when a ChainFaces colour underflowed to the top of `uint256` (JavaScript `Number` rounds that to `2**256`). The background is still forced to white above `0xd8b49f`.

## Missing tokens

`tokenURI` calls `ownerOf` on the collection. A missing id reverts with `ERC721: owner query for nonexistent token`, the same check the original contracts use. Their own `tokenURI` reverts with `ERC721Metadata: URI query for nonexistent token`.

The Azure functions do not check. They return HTTP 200: any MATH id renders, a missing RGB id is a black picture of `(0,0,0)`, and a missing TOON id has an empty name and zero traits. Those bodies are saved under `test/fixtures/{math/0,rgb/0,rgb/188,toon/1}.json`. The renderer does not return them.

## Checking with OnChainChecker

[OnChainChecker](https://onchainchecker.xyz) (`onchainchecker.eth`, which resolves to `0xb04b58D902383B11FDbc3c44fF27Cd0DFa284D35`) scores a token by reading its contract. Its own [linking notes](https://onchainchecker.xyz/llms.txt) give the report URL:

```text
https://onchainchecker.xyz/collection/ethereum/<renderer>/<tokenId>
```

The score API is `GET /api/v1/on-chain-scores?addr=<renderer>&tokenId=<id>` ([docs](https://onchainchecker.xyz/api)). The site calls `tokenURI(uint256)` on that address, which is why each collection has its own renderer.

[0xchain.art](https://0xchain.art/about) shows that score on collection pages. The same page says On-Chain Stars describe the original contract only, and a later contract outside it does not change those stars. Point the checker at the renderer address. The original MATH, RGB and TOON addresses will keep returning an empty `tokenURI`.
