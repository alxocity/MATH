# Renderer

On-chain metadata for the frozen [MATH](https://etherscan.io/address/0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D), [RGB](https://etherscan.io/address/0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956) and [TOON](https://etherscan.io/address/0x026A7D72a448D0E44d441e55F746BF56B843aEDB) contracts. Those contracts stay as they are: `tokenURI` on each one returns `""`, and there is no setter, owner, or proxy to change that.

This is the minimum viable way to put the art and metadata on chain as well. `tokenSVG(uint256)` returns the raw SVG. `tokenJSON(uint256)` returns the JSON metadata, with its image taken from that SVG. `tokenURI(uint256)` returns the JSON as `data:application/json;base64,...`. The original contracts cannot point anywhere. A bad render is fixed by deploying a new renderer. There is no admin key. Whether a marketplace changes a URL it already stored is outside this repo.

## Why three contracts

`src/Render.sol` is one file. It deploys as three contracts, `MATHRender`, `RGBRender` and `TOONRender`, each with `tokenSVG(uint256)`, `tokenJSON(uint256)` and `tokenURI(uint256)`.

OnChainChecker calls `tokenURI` on an address. OpenSea stores a metadata URL and does not call the contract. `tokenSVG` is the raw picture, so a gateway can show it without decoding a data URI. `tokenJSON` is the raw document, for a caller that wants to compose with the original or hand a marketplace its own URL. One contract cannot expose three different `tokenURI` functions. The shared encoder lives in a base contract so the source is not copied; each deployment only carries what it uses. Nothing here is owned, upgradeable, or proxied, and a render reads only the original contracts (plus WORD and ChainFaces, which TOON already reads).

## Gas

Measured with `forge test --match-test test_gas -vv` on a latest-block fork of `https://ethereum.publicnode.com`, block 26,099,671. The figure is the call's frame gas, which is what `eth_call` spends. It does not depend on the fixture block: the picture is a function of the token id and mint-time storage.

| Call | Gas |
| --- | ---: |
| `MATHRender.tokenSVG(1)` | 12,314 |
| `MATHRender.tokenURI(1)` | 394,716 |
| `RGBRender.tokenSVG(100)` | 237,390 |
| `RGBRender.tokenURI(100)` | 2,458,458 |
| `TOONRender.tokenSVG(1973)` | 269,263 |
| `TOONRender.tokenURI(1973)` | 2,398,456 |

These calls have to stay well under the `eth_call` gas cap of the RPC node that reads them. That cap is chosen by the node operator and is not part of the protocol, so this repo does not quote one. `test_gas` fails if a `tokenURI` exceeds 10,000,000 gas.

The 16×16 bitmap is the same string of `<rect>` nodes as the Azure functions. The loop that writes it costs about 155k gas. Base64 keeps its alphabet in scratch space and stores each quartet with one `mstore`. A plain Solidity base64 loop was about 23M gas.

Estimated deployment gas is one transaction per contract: 21,000 plus calldata plus the create frame (code deposit included). From `test_deploy_gas`:

| Contract | Runtime bytes | Deploy gas |
| --- | ---: | ---: |
| `MATHRender` | 5,066 | 1,250,436 |
| `RGBRender` | 3,033 | 778,548 |
| `TOONRender` | 6,345 | 1,547,560 |
| All three | | 3,576,544 |

## Usage

```shell
cd renderer
forge test
```

Fork tests use the latest block on `https://ethereum.publicnode.com`. That node is not an archive, so the tests do not pin an old block unless `MAINNET_RPC_URL` is set to an archive endpoint, in which case the fork is block 26,098,697. No key is required. `ffi` is enabled in `foundry.toml` because the tests decode the data URI in Python and compare it to the Azure snapshots in `test/fixtures/`.

Those snapshots still match at a later block. MATH's picture is the id. RGB's planes and TOON's word, face and rgb ids are written at mint and those contracts have no setter. ChainFaces' face and colours and the WORD string are the same kind of mint-time storage. A transfer changes `ownerOf`, which the renderer uses only to revert when the token is missing. `0` can never be minted. An id that is merely unminted today, such as TOON 1 or RGB 188, could be minted later; the tests do not treat those as permanently missing.

```shell
forge test --match-contract MathTest
forge test --match-test test_gas -vv
```

Deploy, when you mean to, with your own key. This repo does not contain one, and this script has not been broadcast:

```shell
forge script script/Deploy.sol --rpc-url https://ethereum.publicnode.com --private-key $KEY --broadcast
```

After deploy, call `tokenSVG`, `tokenJSON` or `tokenURI` on each renderer with a minted id. Write the three addresses into the root README at that point.

Verify the source on Etherscan and Sourcify from this directory. The compiler settings are the ones in `foundry.toml`: solc 0.8.24, optimizer on, 200 runs, EVM version Cancun. Constructors take no arguments. Repeat for `RGBRender` and `TOONRender`.

```shell
forge verify-contract --chain mainnet --watch \
  --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  $MATH src/Render.sol:MATHRender

forge verify-contract --chain mainnet --verifier sourcify \
  --compiler-version 0.8.24 --num-of-optimizations 200 --evm-version cancun \
  $MATH src/Render.sol:MATHRender
```

`forge script script/Deploy.sol --broadcast --verify` is the same deploy with verification attached. Neither command has been run here.

## Differences from Azure

The snapshots are the live Azure bodies (`/api/math`, `/api/RGB`, `/api/TOON`). Parsed image, name and traits match, except:

- The outer return is a base64 JSON data URI. Azure serves a JSON object whose picture is raw SVG in `image_data`. Here the picture is `image` = `data:image/svg+xml;base64,...`. The decoded SVG matches `image_data` on the fixtures, aside from `viewBox="0 0 350 350"` and `shape-rendering="crispEdges"`. Rects stay on whole viewBox units (`16` for RGB, `12` for TOON) so neighbours touch. The namespace `http://www.w3.org/2000/svg` is the XML name, not a request. There is no stylesheet, web font, external image, or link.
- `external_url` is left out. It is an Etherscan link, not part of the token.
- MATH's description keeps the `0x` hex and the 16×16 ⬛/⬜ bitmap. The UTF-8, UTF-16 and UTF-32 readings of that hex are left out.
- `digit_mean` is rounded to 6 decimal places. Terminating values match (`1`, `7.5`, `9`). Repeating ones differ in the tail: Azure's `0.6666666666666666` is `0.666667`, and `0.05263157894736842` is `0.052632`.
- JSON is compact. Key order is not the Azure order. Decoded fields are what the tests compare.
- A face or word that contains `&`, `<`, `>` or quotes is escaped. None of the sampled tokens need it, so those SVGs still match.

TOON's text colour follows the Azure expression `Number(color - 5).toString(16).padStart(6, "0")`, including the odd cases that function actually produces: `"0000-5"` when the colour is 0, and a 65-digit hex string when a ChainFaces colour underflowed to the top of `uint256` (JavaScript `Number` rounds that to `2**256`). The background is still forced to white above `0xd8b49f`.

## Missing tokens

`tokenSVG` calls `ownerOf` on the collection. `tokenJSON` reads that SVG, and `tokenURI` returns the JSON. A missing id reverts with `ERC721: owner query for nonexistent token`, the same check the original contracts use. Their own `tokenURI` reverts with `ERC721Metadata: URI query for nonexistent token`.

The Azure functions do not check. They return HTTP 200: any MATH id renders, a missing RGB id is a black picture of `(0,0,0)`, and a missing TOON id has an empty name and zero traits. Those bodies are saved under `test/fixtures/{math/0,rgb/0,rgb/188,toon/1}.json`. The renderer does not return them.

## Checking with OnChainChecker

[OnChainChecker](https://onchainchecker.xyz) (`onchainchecker.eth`, which resolves to `0xb04b58D902383B11FDbc3c44fF27Cd0DFa284D35`) scores a token by reading its contract. Its own [linking notes](https://onchainchecker.xyz/llms.txt) give the report URL:

```text
https://onchainchecker.xyz/collection/ethereum/<renderer>/<tokenId>
```

The score API is `GET /api/v1/on-chain-scores?addr=<renderer>&tokenId=<id>` ([docs](https://onchainchecker.xyz/api)). The site calls `tokenURI(uint256)` on that address, which is why each collection has its own renderer.

[0xchain.art](https://0xchain.art/about) shows that score on collection pages. The same page says On-Chain Stars describe the original contract only, and a later contract outside it does not change those stars. Point the checker at the renderer address. The original MATH, RGB and TOON addresses will keep returning an empty `tokenURI`.
