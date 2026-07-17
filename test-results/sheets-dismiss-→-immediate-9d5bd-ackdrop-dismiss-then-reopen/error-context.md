# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sheets.spec.ts >> dismiss → immediate reopen >> Settings: backdrop dismiss, then reopen
- Location: e2e/sheets.spec.ts:108:7

# Error details

```
Error: settings-sheet should rise into the viewport, not sit collapsed below it

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 933
Received:    947

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]: July 2026
        - generic [ref=e12]:
          - button "Previous month" [ref=e13] [cursor=pointer]:
            - generic [ref=e14]: 
          - button "Next month" [ref=e15] [cursor=pointer]:
            - generic [ref=e16]: 
          - button "Settings" [active] [ref=e17] [cursor=pointer]:
            - generic [ref=e18]: 
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: In
          - generic [ref=e22]: ¥0
        - generic [ref=e23]:
          - generic [ref=e24]: Out
          - generic [ref=e25]: ¥0
        - generic [ref=e26]:
          - generic [ref=e27]: Net
          - generic [ref=e28]: +¥0
      - generic [ref=e31]:
        - generic [ref=e36]:
          - generic [ref=e37]:
            - generic [ref=e39]: S
            - generic [ref=e41]: M
            - generic [ref=e43]: T
            - generic [ref=e45]: W
            - generic [ref=e47]: T
            - generic [ref=e49]: F
            - generic [ref=e51]: S
          - generic [ref=e52]:
            - generic [ref=e53]:
              - button "Day 1" [ref=e58] [cursor=pointer]:
                - generic [ref=e59]: "1"
              - button "Day 2" [ref=e61] [cursor=pointer]:
                - generic [ref=e62]: "2"
              - button "Day 3" [ref=e64] [cursor=pointer]:
                - generic [ref=e65]: "3"
              - button "Day 4" [ref=e67] [cursor=pointer]:
                - generic [ref=e68]: "4"
            - generic [ref=e69]:
              - button "Day 5" [ref=e71] [cursor=pointer]:
                - generic [ref=e72]: "5"
              - button "Day 6" [ref=e74] [cursor=pointer]:
                - generic [ref=e75]: "6"
              - button "Day 7" [ref=e77] [cursor=pointer]:
                - generic [ref=e78]: "7"
              - button "Day 8" [ref=e80] [cursor=pointer]:
                - generic [ref=e81]: "8"
              - button "Day 9" [ref=e83] [cursor=pointer]:
                - generic [ref=e84]: "9"
              - button "Day 10" [ref=e86] [cursor=pointer]:
                - generic [ref=e87]: "10"
              - button "Day 11" [ref=e89] [cursor=pointer]:
                - generic [ref=e90]: "11"
            - generic [ref=e91]:
              - button "Day 12" [ref=e93] [cursor=pointer]:
                - generic [ref=e94]: "12"
              - button "Day 13" [ref=e96] [cursor=pointer]:
                - generic [ref=e97]: "13"
              - button "Day 14" [ref=e99] [cursor=pointer]:
                - generic [ref=e100]: "14"
              - button "Day 15" [ref=e102] [cursor=pointer]:
                - generic [ref=e103]: "15"
              - button "Day 16" [ref=e105] [cursor=pointer]:
                - generic [ref=e106]: "16"
              - button "Day 17" [ref=e108] [cursor=pointer]:
                - generic [ref=e109]: "17"
              - button "Day 18" [ref=e111] [cursor=pointer]:
                - generic [ref=e112]: "18"
            - generic [ref=e113]:
              - button "Day 19" [ref=e115] [cursor=pointer]:
                - generic [ref=e116]: "19"
              - button "Day 20" [ref=e118] [cursor=pointer]:
                - generic [ref=e119]: "20"
              - button "Day 21" [ref=e121] [cursor=pointer]:
                - generic [ref=e122]: "21"
              - button "Day 22" [ref=e124] [cursor=pointer]:
                - generic [ref=e125]: "22"
              - button "Day 23" [ref=e127] [cursor=pointer]:
                - generic [ref=e128]: "23"
              - button "Day 24" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: "24"
              - button "Day 25" [ref=e133] [cursor=pointer]:
                - generic [ref=e134]: "25"
            - generic [ref=e135]:
              - button "Day 26" [ref=e137] [cursor=pointer]:
                - generic [ref=e138]: "26"
              - button "Day 27" [ref=e140] [cursor=pointer]:
                - generic [ref=e141]: "27"
              - button "Day 28" [ref=e143] [cursor=pointer]:
                - generic [ref=e144]: "28"
              - button "Day 29" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: "29"
              - button "Day 30" [ref=e149] [cursor=pointer]:
                - generic [ref=e150]: "30"
        - generic [ref=e156]:
          - generic [ref=e157]:
            - generic [ref=e159]: S
            - generic [ref=e161]: M
            - generic [ref=e163]: T
            - generic [ref=e165]: W
            - generic [ref=e167]: T
            - generic [ref=e169]: F
            - generic [ref=e171]: S
          - generic [ref=e172]:
            - generic [ref=e173]:
              - button "Day 1" [ref=e180] [cursor=pointer]:
                - generic [ref=e181]: "1"
              - button "Day 2" [ref=e183] [cursor=pointer]:
                - generic [ref=e184]: "2"
            - generic [ref=e185]:
              - button "Day 3" [ref=e187] [cursor=pointer]:
                - generic [ref=e188]: "3"
              - button "Day 4" [ref=e190] [cursor=pointer]:
                - generic [ref=e191]: "4"
              - button "Day 5" [ref=e193] [cursor=pointer]:
                - generic [ref=e194]: "5"
              - button "Day 6" [ref=e196] [cursor=pointer]:
                - generic [ref=e197]: "6"
              - button "Day 7" [ref=e199] [cursor=pointer]:
                - generic [ref=e200]: "7"
              - button "Day 8" [ref=e202] [cursor=pointer]:
                - generic [ref=e203]: "8"
              - button "Day 9" [ref=e205] [cursor=pointer]:
                - generic [ref=e206]: "9"
            - generic [ref=e207]:
              - button "Day 10" [ref=e209] [cursor=pointer]:
                - generic [ref=e210]: "10"
              - button "Day 11" [ref=e212] [cursor=pointer]:
                - generic [ref=e213]: "11"
              - button "Day 12" [ref=e215] [cursor=pointer]:
                - generic [ref=e216]: "12"
              - button "Day 13" [ref=e218] [cursor=pointer]:
                - generic [ref=e219]: "13"
              - button "Day 14" [ref=e221] [cursor=pointer]:
                - generic [ref=e222]: "14"
              - button "Day 15" [ref=e224] [cursor=pointer]:
                - generic [ref=e225]: "15"
              - button "Day 16" [ref=e227] [cursor=pointer]:
                - generic [ref=e228]: "16"
            - generic [ref=e229]:
              - button "Day 17" [ref=e231] [cursor=pointer]:
                - generic [ref=e232]: "17"
              - button "Day 18" [ref=e234] [cursor=pointer]:
                - generic [ref=e235]: "18"
              - button "Day 19" [ref=e237] [cursor=pointer]:
                - generic [ref=e238]: "19"
              - button "Day 20" [ref=e240] [cursor=pointer]:
                - generic [ref=e241]: "20"
              - button "Day 21" [ref=e243] [cursor=pointer]:
                - generic [ref=e244]: "21"
              - button "Day 22" [ref=e246] [cursor=pointer]:
                - generic [ref=e247]: "22"
              - button "Day 23" [ref=e249] [cursor=pointer]:
                - generic [ref=e250]: "23"
            - generic [ref=e251]:
              - button "Day 24" [ref=e253] [cursor=pointer]:
                - generic [ref=e254]: "24"
              - button "Day 25" [ref=e256] [cursor=pointer]:
                - generic [ref=e257]: "25"
              - button "Day 26" [ref=e259] [cursor=pointer]:
                - generic [ref=e260]: "26"
              - button "Day 27" [ref=e262] [cursor=pointer]:
                - generic [ref=e263]: "27"
              - button "Day 28" [ref=e265] [cursor=pointer]:
                - generic [ref=e266]: "28"
              - button "Day 29" [ref=e268] [cursor=pointer]:
                - generic [ref=e269]: "29"
              - button "Day 30" [ref=e271] [cursor=pointer]:
                - generic [ref=e272]: "30"
            - button "Day 31" [ref=e275] [cursor=pointer]:
              - generic [ref=e276]: "31"
        - generic [ref=e286]:
          - generic [ref=e287]:
            - generic [ref=e289]: S
            - generic [ref=e291]: M
            - generic [ref=e293]: T
            - generic [ref=e295]: W
            - generic [ref=e297]: T
            - generic [ref=e299]: F
            - generic [ref=e301]: S
          - generic [ref=e302]:
            - generic [ref=e303]:
              - button "Day 1" [ref=e306] [cursor=pointer]:
                - generic [ref=e307]: "1"
              - button "Day 2" [ref=e309] [cursor=pointer]:
                - generic [ref=e310]: "2"
              - button "Day 3" [ref=e312] [cursor=pointer]:
                - generic [ref=e313]: "3"
              - button "Day 4" [ref=e315] [cursor=pointer]:
                - generic [ref=e316]: "4"
              - button "Day 5" [ref=e318] [cursor=pointer]:
                - generic [ref=e319]: "5"
              - button "Day 6" [ref=e321] [cursor=pointer]:
                - generic [ref=e322]: "6"
            - generic [ref=e323]:
              - button "Day 7" [ref=e325] [cursor=pointer]:
                - generic [ref=e326]: "7"
              - button "Day 8" [ref=e328] [cursor=pointer]:
                - generic [ref=e329]: "8"
              - button "Day 9" [ref=e331] [cursor=pointer]:
                - generic [ref=e332]: "9"
              - button "Day 10" [ref=e334] [cursor=pointer]:
                - generic [ref=e335]: "10"
              - button "Day 11" [ref=e337] [cursor=pointer]:
                - generic [ref=e338]: "11"
              - button "Day 12" [ref=e340] [cursor=pointer]:
                - generic [ref=e341]: "12"
              - button "Day 13" [ref=e343] [cursor=pointer]:
                - generic [ref=e344]: "13"
            - generic [ref=e345]:
              - button "Day 14" [ref=e347] [cursor=pointer]:
                - generic [ref=e348]: "14"
              - button "Day 15" [ref=e350] [cursor=pointer]:
                - generic [ref=e351]: "15"
              - button "Day 16" [ref=e353] [cursor=pointer]:
                - generic [ref=e354]: "16"
              - button "Day 17" [ref=e356] [cursor=pointer]:
                - generic [ref=e357]: "17"
              - button "Day 18" [ref=e359] [cursor=pointer]:
                - generic [ref=e360]: "18"
              - button "Day 19" [ref=e362] [cursor=pointer]:
                - generic [ref=e363]: "19"
              - button "Day 20" [ref=e365] [cursor=pointer]:
                - generic [ref=e366]: "20"
            - generic [ref=e367]:
              - button "Day 21" [ref=e369] [cursor=pointer]:
                - generic [ref=e370]: "21"
              - button "Day 22" [ref=e372] [cursor=pointer]:
                - generic [ref=e373]: "22"
              - button "Day 23" [ref=e375] [cursor=pointer]:
                - generic [ref=e376]: "23"
              - button "Day 24" [ref=e378] [cursor=pointer]:
                - generic [ref=e379]: "24"
              - button "Day 25" [ref=e381] [cursor=pointer]:
                - generic [ref=e382]: "25"
              - button "Day 26" [ref=e384] [cursor=pointer]:
                - generic [ref=e385]: "26"
              - button "Day 27" [ref=e387] [cursor=pointer]:
                - generic [ref=e388]: "27"
            - generic [ref=e389]:
              - button "Day 28" [ref=e391] [cursor=pointer]:
                - generic [ref=e392]: "28"
              - button "Day 29" [ref=e394] [cursor=pointer]:
                - generic [ref=e395]: "29"
              - button "Day 30" [ref=e397] [cursor=pointer]:
                - generic [ref=e398]: "30"
        - generic [ref=e406]:
          - generic [ref=e407]:
            - generic [ref=e409]: S
            - generic [ref=e411]: M
            - generic [ref=e413]: T
            - generic [ref=e415]: W
            - generic [ref=e417]: T
            - generic [ref=e419]: F
            - generic [ref=e421]: S
          - generic [ref=e422]:
            - generic [ref=e423]:
              - button "Day 1" [ref=e428] [cursor=pointer]:
                - generic [ref=e429]: "1"
              - button "Day 2" [ref=e431] [cursor=pointer]:
                - generic [ref=e432]: "2"
              - button "Day 3" [ref=e434] [cursor=pointer]:
                - generic [ref=e435]: "3"
              - button "Day 4" [ref=e437] [cursor=pointer]:
                - generic [ref=e438]: "4"
            - generic [ref=e439]:
              - button "Day 5" [ref=e441] [cursor=pointer]:
                - generic [ref=e442]: "5"
              - button "Day 6" [ref=e444] [cursor=pointer]:
                - generic [ref=e445]: "6"
              - button "Day 7" [ref=e447] [cursor=pointer]:
                - generic [ref=e448]: "7"
              - button "Day 8" [ref=e450] [cursor=pointer]:
                - generic [ref=e451]: "8"
              - button "Day 9" [ref=e453] [cursor=pointer]:
                - generic [ref=e454]: "9"
              - button "Day 10" [ref=e456] [cursor=pointer]:
                - generic [ref=e457]: "10"
              - button "Day 11" [ref=e459] [cursor=pointer]:
                - generic [ref=e460]: "11"
            - generic [ref=e461]:
              - button "Day 12" [ref=e463] [cursor=pointer]:
                - generic [ref=e464]: "12"
              - button "Day 13" [ref=e466] [cursor=pointer]:
                - generic [ref=e467]: "13"
              - button "Day 14" [ref=e469] [cursor=pointer]:
                - generic [ref=e470]: "14"
              - button "Day 15" [ref=e472] [cursor=pointer]:
                - generic [ref=e473]: "15"
              - button "Day 16" [ref=e475] [cursor=pointer]:
                - generic [ref=e476]: "16"
              - button "Day 17" [ref=e478] [cursor=pointer]:
                - generic [ref=e479]: "17"
              - button "Day 18" [ref=e481] [cursor=pointer]:
                - generic [ref=e482]: "18"
            - generic [ref=e483]:
              - button "Day 19" [ref=e485] [cursor=pointer]:
                - generic [ref=e486]: "19"
              - button "Day 20" [ref=e488] [cursor=pointer]:
                - generic [ref=e489]: "20"
              - button "Day 21" [ref=e491] [cursor=pointer]:
                - generic [ref=e492]: "21"
              - button "Day 22" [ref=e494] [cursor=pointer]:
                - generic [ref=e495]: "22"
              - button "Day 23" [ref=e497] [cursor=pointer]:
                - generic [ref=e498]: "23"
              - button "Day 24" [ref=e500] [cursor=pointer]:
                - generic [ref=e501]: "24"
              - button "Day 25" [ref=e503] [cursor=pointer]:
                - generic [ref=e504]: "25"
            - generic [ref=e505]:
              - button "Day 26" [ref=e507] [cursor=pointer]:
                - generic [ref=e508]: "26"
              - button "Day 27" [ref=e510] [cursor=pointer]:
                - generic [ref=e511]: "27"
              - button "Day 28" [ref=e513] [cursor=pointer]:
                - generic [ref=e514]: "28"
              - button "Day 29" [ref=e516] [cursor=pointer]:
                - generic [ref=e517]: "29"
              - button "Day 30" [ref=e519] [cursor=pointer]:
                - generic [ref=e520]: "30"
              - button "Day 31" [ref=e522] [cursor=pointer]:
                - generic [ref=e523]: "31"
        - generic [ref=e528]:
          - generic [ref=e529]:
            - generic [ref=e531]: S
            - generic [ref=e533]: M
            - generic [ref=e535]: T
            - generic [ref=e537]: W
            - generic [ref=e539]: T
            - generic [ref=e541]: F
            - generic [ref=e543]: S
          - generic [ref=e544]:
            - button "Day 1" [ref=e553] [cursor=pointer]:
              - generic [ref=e554]: "1"
            - generic [ref=e555]:
              - button "Day 2" [ref=e557] [cursor=pointer]:
                - generic [ref=e558]: "2"
              - button "Day 3" [ref=e560] [cursor=pointer]:
                - generic [ref=e561]: "3"
              - button "Day 4" [ref=e563] [cursor=pointer]:
                - generic [ref=e564]: "4"
              - button "Day 5" [ref=e566] [cursor=pointer]:
                - generic [ref=e567]: "5"
              - button "Day 6" [ref=e569] [cursor=pointer]:
                - generic [ref=e570]: "6"
              - button "Day 7" [ref=e572] [cursor=pointer]:
                - generic [ref=e573]: "7"
              - button "Day 8" [ref=e575] [cursor=pointer]:
                - generic [ref=e576]: "8"
            - generic [ref=e577]:
              - button "Day 9" [ref=e579] [cursor=pointer]:
                - generic [ref=e580]: "9"
              - button "Day 10" [ref=e582] [cursor=pointer]:
                - generic [ref=e583]: "10"
              - button "Day 11" [ref=e585] [cursor=pointer]:
                - generic [ref=e586]: "11"
              - button "Day 12" [ref=e588] [cursor=pointer]:
                - generic [ref=e589]: "12"
              - button "Day 13" [ref=e591] [cursor=pointer]:
                - generic [ref=e592]: "13"
              - button "Day 14" [ref=e594] [cursor=pointer]:
                - generic [ref=e595]: "14"
              - button "Day 15" [ref=e597] [cursor=pointer]:
                - generic [ref=e598]: "15"
            - generic [ref=e599]:
              - button "Day 16" [ref=e601] [cursor=pointer]:
                - generic [ref=e602]: "16"
              - button "Day 17" [ref=e604] [cursor=pointer]:
                - generic [ref=e605]: "17"
              - button "Day 18" [ref=e607] [cursor=pointer]:
                - generic [ref=e608]: "18"
              - button "Day 19" [ref=e610] [cursor=pointer]:
                - generic [ref=e611]: "19"
              - button "Day 20" [ref=e613] [cursor=pointer]:
                - generic [ref=e614]: "20"
              - button "Day 21" [ref=e616] [cursor=pointer]:
                - generic [ref=e617]: "21"
              - button "Day 22" [ref=e619] [cursor=pointer]:
                - generic [ref=e620]: "22"
            - generic [ref=e621]:
              - button "Day 23" [ref=e623] [cursor=pointer]:
                - generic [ref=e624]: "23"
              - button "Day 24" [ref=e626] [cursor=pointer]:
                - generic [ref=e627]: "24"
              - button "Day 25" [ref=e629] [cursor=pointer]:
                - generic [ref=e630]: "25"
              - button "Day 26" [ref=e632] [cursor=pointer]:
                - generic [ref=e633]: "26"
              - button "Day 27" [ref=e635] [cursor=pointer]:
                - generic [ref=e636]: "27"
              - button "Day 28" [ref=e638] [cursor=pointer]:
                - generic [ref=e639]: "28"
              - button "Day 29" [ref=e641] [cursor=pointer]:
                - generic [ref=e642]: "29"
            - generic [ref=e643]:
              - button "Day 30" [ref=e645] [cursor=pointer]:
                - generic [ref=e646]: "30"
              - button "Day 31" [ref=e648] [cursor=pointer]:
                - generic [ref=e649]: "31"
        - generic [ref=e658]:
          - generic [ref=e659]:
            - generic [ref=e661]: S
            - generic [ref=e663]: M
            - generic [ref=e665]: T
            - generic [ref=e667]: W
            - generic [ref=e669]: T
            - generic [ref=e671]: F
            - generic [ref=e673]: S
          - generic [ref=e674]:
            - generic [ref=e675]:
              - button "Day 1" [ref=e679] [cursor=pointer]:
                - generic [ref=e680]: "1"
              - button "Day 2" [ref=e682] [cursor=pointer]:
                - generic [ref=e683]: "2"
              - button "Day 3" [ref=e685] [cursor=pointer]:
                - generic [ref=e686]: "3"
              - button "Day 4" [ref=e688] [cursor=pointer]:
                - generic [ref=e689]: "4"
              - button "Day 5" [ref=e691] [cursor=pointer]:
                - generic [ref=e692]: "5"
            - generic [ref=e693]:
              - button "Day 6" [ref=e695] [cursor=pointer]:
                - generic [ref=e696]: "6"
              - button "Day 7" [ref=e698] [cursor=pointer]:
                - generic [ref=e699]: "7"
              - button "Day 8" [ref=e701] [cursor=pointer]:
                - generic [ref=e702]: "8"
              - button "Day 9" [ref=e704] [cursor=pointer]:
                - generic [ref=e705]: "9"
              - button "Day 10" [ref=e707] [cursor=pointer]:
                - generic [ref=e708]: "10"
              - button "Day 11" [ref=e710] [cursor=pointer]:
                - generic [ref=e711]: "11"
              - button "Day 12" [ref=e713] [cursor=pointer]:
                - generic [ref=e714]: "12"
            - generic [ref=e715]:
              - button "Day 13" [ref=e717] [cursor=pointer]:
                - generic [ref=e718]: "13"
              - button "Day 14" [ref=e720] [cursor=pointer]:
                - generic [ref=e721]: "14"
              - button "Day 15" [ref=e723] [cursor=pointer]:
                - generic [ref=e724]: "15"
              - button "Day 16" [ref=e726] [cursor=pointer]:
                - generic [ref=e727]: "16"
              - button "Day 17" [ref=e729] [cursor=pointer]:
                - generic [ref=e730]: "17"
              - button "Day 18" [ref=e732] [cursor=pointer]:
                - generic [ref=e733]: "18"
              - button "Day 19" [ref=e735] [cursor=pointer]:
                - generic [ref=e736]: "19"
            - generic [ref=e737]:
              - button "Day 20" [ref=e739] [cursor=pointer]:
                - generic [ref=e740]: "20"
              - button "Day 21" [ref=e742] [cursor=pointer]:
                - generic [ref=e743]: "21"
              - button "Day 22" [ref=e745] [cursor=pointer]:
                - generic [ref=e746]: "22"
              - button "Day 23" [ref=e748] [cursor=pointer]:
                - generic [ref=e749]: "23"
              - button "Day 24" [ref=e751] [cursor=pointer]:
                - generic [ref=e752]: "24"
              - button "Day 25" [ref=e754] [cursor=pointer]:
                - generic [ref=e755]: "25"
              - button "Day 26" [ref=e757] [cursor=pointer]:
                - generic [ref=e758]: "26"
            - generic [ref=e759]:
              - button "Day 27" [ref=e761] [cursor=pointer]:
                - generic [ref=e762]: "27"
              - button "Day 28" [ref=e764] [cursor=pointer]:
                - generic [ref=e765]: "28"
              - button "Day 29" [ref=e767] [cursor=pointer]:
                - generic [ref=e768]: "29"
              - button "Day 30" [ref=e770] [cursor=pointer]:
                - generic [ref=e771]: "30"
      - generic [ref=e776]:
        - generic [ref=e777]: Mon, Jul 13
        - generic [ref=e778]: +¥0
      - generic [ref=e780]: No entries this day. Tap ＋ to add one.
    - generic [ref=e781]:
      - tab "Calendar" [ref=e782] [cursor=pointer]:
        - generic [ref=e783]: 
        - generic [ref=e784]: Calendar
      - button "Add entry" [ref=e785] [cursor=pointer]:
        - generic [ref=e786]: 
      - tab "Summary" [ref=e787] [cursor=pointer]:
        - generic [ref=e788]: 
        - generic [ref=e789]: Summary
  - button "Bottom sheet backdrop" [ref=e790] [cursor=pointer]
  - generic [ref=e791]:
    - slider "Bottom Sheet"
    - slider "sheet-surface":
      - generic [ref=e793]:
        - generic [ref=e794]:
          - generic [ref=e795]: Settings
          - button "Close" [ref=e796] [cursor=pointer]:
            - generic [ref=e797]: 
        - generic [ref=e799]:
          - generic [ref=e800]:
            - generic [ref=e801]: Appearance
            - generic [ref=e802]:
              - radio "Dark" [ref=e803] [cursor=pointer]:
                - generic [ref=e804]: Dark
              - radio "Light" [ref=e805] [cursor=pointer]:
                - generic [ref=e806]: Light
          - generic [ref=e807]:
            - generic [ref=e808]: Open to
            - generic [ref=e809]:
              - radio "Calendar" [ref=e810] [cursor=pointer]:
                - generic [ref=e811]: Calendar
              - radio "Entry" [ref=e812] [cursor=pointer]:
                - generic [ref=e813]: Entry
          - generic [ref=e814]:
            - generic [ref=e815]: Lock
            - generic [ref=e816]:
              - generic [ref=e817]:
                - generic [ref=e818]: Lock
                - generic [ref=e819]: Set up Face ID, Touch ID, or a passcode on this device to use this.
              - switch "Lock" [disabled]:
                - generic [ref=e820]: "Off"
          - generic [ref=e821]:
            - generic [ref=e822]: Currency
            - generic [ref=e823]:
              - radio "JPY ¥" [ref=e824] [cursor=pointer]:
                - generic [ref=e825]: ¥ JPY
              - radio "USD $" [ref=e826] [cursor=pointer]:
                - generic [ref=e827]: $ USD
              - radio "EUR €" [ref=e828] [cursor=pointer]:
                - generic [ref=e829]: € EUR
              - radio "GBP £" [ref=e830] [cursor=pointer]:
                - generic [ref=e831]: £ GBP
          - generic [ref=e832]:
            - generic [ref=e833]:
              - generic [ref=e834]: Categories
              - generic [ref=e835]:
                - radio "Expense" [ref=e836] [cursor=pointer]:
                  - generic [ref=e837]: Expense
                - radio "Income" [ref=e838] [cursor=pointer]:
                  - generic [ref=e839]: Income
            - generic [ref=e840]:
              - generic [ref=e841]:
                - generic [ref=e843]: FO
                - generic [ref=e844]: Food
                - button "Move Food up" [ref=e845] [cursor=pointer]:
                  - generic [ref=e846]: 
                - button "Move Food down" [ref=e847] [cursor=pointer]:
                  - generic [ref=e848]: 
                - button "Remove Food" [ref=e849] [cursor=pointer]:
                  - generic [ref=e850]: 
              - generic [ref=e851]:
                - generic [ref=e853]: TR
                - generic [ref=e854]: Transport
                - button "Move Transport up" [ref=e855] [cursor=pointer]:
                  - generic [ref=e856]: 
                - button "Move Transport down" [ref=e857] [cursor=pointer]:
                  - generic [ref=e858]: 
                - button "Remove Transport" [ref=e859] [cursor=pointer]:
                  - generic [ref=e860]: 
              - generic [ref=e861]:
                - generic [ref=e863]: SH
                - generic [ref=e864]: Shopping
                - button "Move Shopping up" [ref=e865] [cursor=pointer]:
                  - generic [ref=e866]: 
                - button "Move Shopping down" [ref=e867] [cursor=pointer]:
                  - generic [ref=e868]: 
                - button "Remove Shopping" [ref=e869] [cursor=pointer]:
                  - generic [ref=e870]: 
              - generic [ref=e871]:
                - generic [ref=e873]: BI
                - generic [ref=e874]: Bills
                - button "Move Bills up" [ref=e875] [cursor=pointer]:
                  - generic [ref=e876]: 
                - button "Move Bills down" [ref=e877] [cursor=pointer]:
                  - generic [ref=e878]: 
                - button "Remove Bills" [ref=e879] [cursor=pointer]:
                  - generic [ref=e880]: 
              - generic [ref=e881]:
                - generic [ref=e883]: HE
                - generic [ref=e884]: Health
                - button "Move Health up" [ref=e885] [cursor=pointer]:
                  - generic [ref=e886]: 
                - button "Move Health down" [ref=e887] [cursor=pointer]:
                  - generic [ref=e888]: 
                - button "Remove Health" [ref=e889] [cursor=pointer]:
                  - generic [ref=e890]: 
              - generic [ref=e891]:
                - generic [ref=e893]: EN
                - generic [ref=e894]: Entertainment
                - button "Move Entertainment up" [ref=e895] [cursor=pointer]:
                  - generic [ref=e896]: 
                - button "Move Entertainment down" [ref=e897] [cursor=pointer]:
                  - generic [ref=e898]: 
                - button "Remove Entertainment" [ref=e899] [cursor=pointer]:
                  - generic [ref=e900]: 
            - generic [ref=e901]:
              - textbox "Category name" [ref=e902]:
                - /placeholder: Add category
              - button "Add category" [disabled]:
                - generic [ref=e903]: Add
          - generic [ref=e904]:
            - generic [ref=e905]: Budgets
            - button "Budgets" [ref=e906] [cursor=pointer]:
              - generic [ref=e907]: Budgets
              - generic [ref=e908]: ›
          - generic [ref=e909]:
            - generic [ref=e910]: Data
            - button "Load sample data" [ref=e911] [cursor=pointer]:
              - generic [ref=e912]: Load sample data
            - button "Export data" [ref=e913] [cursor=pointer]:
              - generic [ref=e914]: Export data
            - button "Import from Zaim" [ref=e915] [cursor=pointer]:
              - generic [ref=e916]: Import from Zaim
            - button "Delete all data" [ref=e917] [cursor=pointer]:
              - generic [ref=e918]: Delete all data
```

# Test source

```ts
  1   | /**
  2   |  * Shared driver for the sheet-regression suite (#58). Drives the exported Expo
  3   |  * web build exactly the way the user does: real page loads, taps at the
  4   |  * physical coordinates of the controls, no synthetic state.
  5   |  *
  6   |  * Selectors are the app's own accessibility labels (i18n/strings.ts, pinned to
  7   |  * en-US in playwright.config.ts) plus the three sheet testIDs threaded through
  8   |  * nav/BottomSheet.tsx — no bespoke test hooks beyond those anchors.
  9   |  */
  10  | import { expect, type Locator, type Page } from '@playwright/test';
  11  | 
  12  | /** How long a tapped sheet gets to become visible before we call the open failed. */
  13  | export const OPEN_TIMEOUT = 5_000;
  14  | 
  15  | export type SheetId = 'entry-sheet' | 'settings-sheet' | 'budgets-sheet';
  16  | 
  17  | /**
  18  |  * A fresh cold page load: navigate, then wait for the app to pass its
  19  |  * fonts/persisted-state gate (the tab bar's ＋ FAB appearing is that signal).
  20  |  * Returns the fixed screen coordinates of the ＋ FAB and the Settings gear so
  21  |  * callers can tap like a finger does — at the position, immediately, without
  22  |  * Playwright's stability waits softening the first-tap race.
  23  |  */
  24  | export async function coldLoad(page: Page) {
  25  |   await page.goto('/');
  26  |   const fab = page.getByLabel('Add entry', { exact: true });
  27  |   await expect(fab).toBeVisible();
  28  |   const gear = page.getByLabel('Settings', { exact: true });
  29  |   const fabBox = (await fab.boundingBox())!;
  30  |   const gearBox = (await gear.boundingBox())!;
  31  |   return {
  32  |     fab: { x: fabBox.x + fabBox.width / 2, y: fabBox.y + fabBox.height / 2 },
  33  |     gear: { x: gearBox.x + gearBox.width / 2, y: gearBox.y + gearBox.height / 2 },
  34  |   };
  35  | }
  36  | 
  37  | /** Raw tap at screen coordinates — no actionability waits, like a real finger. */
  38  | export async function tapAt(page: Page, point: { x: number; y: number }) {
  39  |   await page.mouse.click(point.x, point.y);
  40  | }
  41  | 
  42  | export function sheet(page: Page, id: SheetId): Locator {
  43  |   return page.getByTestId(id);
  44  | }
  45  | 
  46  | /** Assert the sheet's content view is visible and inside the viewport. */
  47  | export async function expectSheetOpen(
  48  |   page: Page,
  49  |   id: SheetId,
  50  |   message?: string,
  51  | ) {
  52  |   const content = sheet(page, id);
  53  |   await expect(content, message).toBeVisible({ timeout: OPEN_TIMEOUT });
  54  |   const viewport = page.viewportSize()!;
  55  |   // gorhom marks the content view visible at the START of the ~300ms slide-up
  56  |   // present animation, so a box sampled the instant `toBeVisible` resolves
  57  |   // catches the sheet still translated below the fold (box bottom overshoots
  58  |   // the viewport). Retry the geometry assertions until the sheet settles into
  59  |   // the viewport (#63) — a sheet that never rises still fails at OPEN_TIMEOUT.
  60  |   await expect(async () => {
  61  |     const box = (await content.boundingBox())!;
  62  |     expect(box.y, `${id} top edge should be on screen${message ? ` — ${message}` : ''}`)
  63  |       .toBeGreaterThanOrEqual(0);
  64  |     expect(
  65  |       box.y + box.height,
  66  |       `${id} should rise into the viewport, not sit collapsed below it${message ? ` — ${message}` : ''}`,
  67  |     ).toBeLessThanOrEqual(viewport.height + 1);
> 68  |   }).toPass({ timeout: OPEN_TIMEOUT });
      |      ^ Error: settings-sheet should rise into the viewport, not sit collapsed below it
  69  | }
  70  | 
  71  | /** Wait for a sheet to be fully gone (gorhom unmounts children after dismiss). */
  72  | export async function expectSheetGone(page: Page, id: SheetId) {
  73  |   await expect(sheet(page, id)).toBeHidden({ timeout: OPEN_TIMEOUT });
  74  | }
  75  | 
  76  | /**
  77  |  * Dismiss the currently-open sheet by tapping the dimmed backdrop — a point
  78  |  * horizontally centered in the phone frame, safely above the sheet's top edge.
  79  |  */
  80  | export async function tapBackdrop(page: Page, id: SheetId) {
  81  |   const box = (await sheet(page, id).boundingBox())!;
  82  |   expect(box.y, 'need visible backdrop above the sheet to tap').toBeGreaterThan(70);
  83  |   await page.mouse.click(page.viewportSize()!.width / 2, box.y - 40);
  84  | }
  85  | 
  86  | /**
  87  |  * Ghost-overlay probe (#60): after a dismissal — or a failed open — a tap on a
  88  |  * calendar day must still register. If an invisible layer is eating taps, the
  89  |  * day never becomes selected and this fails.
  90  |  *
  91  |  * Selection is read off the tile's own background, not `aria-selected`:
  92  |  * react-native-web does not emit `aria-selected` for `accessibilityRole=
  93  |  * "button"` (the DayCell role), so the attribute is always absent even for the
  94  |  * visibly-selected day. The selected day is the only cell painted a solid
  95  |  * accent tile; every other day is transparent, so "background stopped being
  96  |  * transparent" is the truthful signal that the tap landed and selection moved.
  97  |  */
  98  | async function dayIsSelected(cell: Locator): Promise<boolean> {
  99  |   const bg = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  100 |   return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  101 | }
  102 | 
  103 | export async function expectCalendarTappable(page: Page, message?: string) {
  104 |   // Two candidate days so the probe works whatever day is already selected.
  105 |   for (const day of [3, 4]) {
  106 |     const cell = await visibleDay(page, day);
  107 |     if (await dayIsSelected(cell)) continue;
  108 |     await tapAt(page, await center(cell));
  109 |     await expect(
  110 |       async () => expect(await dayIsSelected(cell)).toBe(true),
  111 |       `calendar day ${day} tap did not register — tap-eating ghost overlay?${message ? ` — ${message}` : ''}`,
  112 |     ).toPass({ timeout: 2_000 });
  113 |     return;
  114 |   }
  115 |   throw new Error('both probe days were already selected — cannot happen');
  116 | }
  117 | 
  118 | /**
  119 |  * The month pager keeps neighbor months mounted offscreen, so a day label can
  120 |  * match several cells; pick the one inside the viewport.
  121 |  */
  122 | export async function visibleDay(page: Page, day: number): Promise<Locator> {
  123 |   const cells = page.getByLabel(`Day ${day}`, { exact: true });
  124 |   const width = page.viewportSize()!.width;
  125 |   for (const cell of await cells.all()) {
  126 |     const box = await cell.boundingBox();
  127 |     if (box && box.x >= 0 && box.x + box.width <= width + 1) return cell;
  128 |   }
  129 |   throw new Error(`no on-screen calendar cell for day ${day}`);
  130 | }
  131 | 
  132 | export async function center(locator: Locator): Promise<{ x: number; y: number }> {
  133 |   const box = (await locator.boundingBox())!;
  134 |   return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  135 | }
  136 | 
  137 | /**
  138 |  * Dead zone below the sheet's content (#61): distance from the bottom of the
  139 |  * lowest rendered child to the bottom of the sheet's content view. With
  140 |  * dynamic content-height sizing this should be ~0 (the view's own bottom
  141 |  * padding is outside the children, so it never counts as dead zone).
  142 |  */
  143 | export async function deadZoneBelowContent(page: Page, id: SheetId): Promise<number> {
  144 |   return sheet(page, id).evaluate((el) => {
  145 |     // Deepest rendered boxes, not direct children: a fixed-height scroll
  146 |     // container would otherwise mask blank space under its last row. Scrollable
  147 |     // content extending past the sheet yields a negative gap — no dead zone.
  148 |     let maxBottom = Number.NEGATIVE_INFINITY;
  149 |     for (const c of el.querySelectorAll('*')) {
  150 |       if (c.children.length > 0) continue;
  151 |       const r = c.getBoundingClientRect();
  152 |       if (r.height > 0 && r.width > 0) maxBottom = Math.max(maxBottom, r.bottom);
  153 |     }
  154 |     if (maxBottom === Number.NEGATIVE_INFINITY) return Number.POSITIVE_INFINITY;
  155 |     return el.getBoundingClientRect().bottom - maxBottom;
  156 |   });
  157 | }
  158 | 
```