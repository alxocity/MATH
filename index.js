#!/usr/bin/env node
'use strict';
const express = require('express');
const helmet = require('helmet');
const TextToSVG = require('text-to-svg');
const textToSVG = TextToSVG.loadSync();

const server = express().use(helmet());

server.get('/math/:tokenId', async (req, res) => {
  const { tokenId } = req.params;
  return res.status(200).json({
    image_data: textToSVG.getSVG(tokenId),
    external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${tokenId}`,
    name: tokenId
  });
});

server.listen(80);