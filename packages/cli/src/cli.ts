#!/usr/bin/env node
import { Command } from 'commander'

const program = new Command()
  .name('autoposting')
  .description('Autoposting CLI — manage social media from the terminal')
  .version('0.1.0')

program.parse()
