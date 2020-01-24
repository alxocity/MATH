pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";

contract TOON is ERC721Full {

    IERC721 public constant MATH = IERC721(address(0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D));
    IERC721 public constant WORD = IERC721(address(0xAc1AEe5027FCC98d40a26588aC0841a44f53A8Fe));
    IERC721 public constant FACE = IERC721(address(0x91047Abf3cAb8da5A9515c8750Ab33B4f1560a7A));
    IERC721 public constant RGB = IERC721(address(0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956));

    struct Metadata {
        uint word;
        uint face;
        uint rgb;
    }

    mapping(uint => uint) word_to_math;
    mapping(uint => uint) face_to_math;
    mapping(uint => uint) rgb_to_math;
    mapping(uint => Metadata) math_to_toon;

    constructor() ERC721Full("TOON", "TOON") public { }

    function add(uint mathId, uint wordId, uint faceId, uint rgbId) public {
        require(MATH.ownerOf(mathId) == msg.sender);
        require(WORD.ownerOf(wordId) == msg.sender);
        require(FACE.ownerOf(faceId) == msg.sender);
        require(RGB.ownerOf(rgbId) == msg.sender);
        require(word_to_math[wordId] == 0);
        require(face_to_math[faceId] == 0);
        require(rgb_to_math[rgbId] == 0);
        word_to_math[wordId] = face_to_math[faceId] = rgb_to_math[rgbId] = mathId;
        math_to_toon[mathId] = Metadata(wordId, faceId, rgbId);
        _mint(msg.sender, mathId);
    }

    function get(uint id) external view returns (uint word, uint face, uint rgb) {
        Metadata memory toon = math_to_toon[id];
        word = toon.word;
        face = toon.face;
        rgb = toon.rgb;
    }
}