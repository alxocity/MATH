pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";

contract RGB is ERC721Full {
    using Address for address payable;

    IERC721 public constant MATH = IERC721(address(0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D));

    struct Metadata {
        uint r;
        uint g;
        uint b;
    }

    mapping(uint => uint) r_to_id;
    mapping(uint => uint) g_to_id;
    mapping(uint => uint) b_to_id;
    mapping(uint => Metadata) id_to_rgb;

    constructor() ERC721Full("RGB", "RGB") public { }

    function add(uint tokenIdR, uint tokenIdG, uint tokenIdB) public payable {
        require(msg.value == 30 finney);
        require(r_to_id[tokenIdR] == 0);
        require(g_to_id[tokenIdG] == 0);
        require(b_to_id[tokenIdB] == 0);
        uint tokenId = r_to_id[tokenIdR] = g_to_id[tokenIdG] = b_to_id[tokenIdB] = totalSupply() + 1;
        id_to_rgb[tokenId] = Metadata(tokenIdR, tokenIdG, tokenIdB);
        _mint(msg.sender, tokenId);
        MATH.ownerOf(tokenIdR).toPayable().sendValue(10 finney);
        MATH.ownerOf(tokenIdG).toPayable().sendValue(10 finney);
        MATH.ownerOf(tokenIdB).toPayable().sendValue(10 finney);
    }

    function get(uint id) external view returns (uint r, uint g, uint b) {
        Metadata memory rgb = id_to_rgb[id];
        r = rgb.r;
        g = rgb.g;
        b = rgb.b;
    }
}