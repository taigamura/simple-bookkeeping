# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: probe.spec.ts >> probe: console/page errors on taps; do taps register; any sheet DOM?
- Location: e2e/probe.spec.ts:6:5

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.click: Test timeout of 180000ms exceeded.
Call log:
  - waiting for getByLabel('Settings', { exact: true })
    - locator resolved to <button tabindex="0" role="button" type="button" aria-label="Settings" class="css-g5y9jx r-1loqt21 r-1otgn73 r-1awozwy r-5t7aoe r-zx9znk r-1777fci r-5orghg">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div tabindex="0" class="css-g5y9jx r-1loqt21 r-1otgn73 r-1awozwy r-eu3ka r-1777fci r-13qz1uu">…</div> from <div class="css-g5y9jx r-1d2f490 r-u8s1d r-zchlnj r-12vffkv">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div tabindex="0" class="css-g5y9jx r-1loqt21 r-1otgn73 r-1awozwy r-eu3ka r-1777fci r-13qz1uu">…</div> from <div class="css-g5y9jx r-1d2f490 r-u8s1d r-zchlnj r-12vffkv">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    318 × waiting for element to be visible, enabled and stable
        - element is visible, enabled and stable
        - scrolling into view if needed
        - done scrolling
        - <div tabindex="0" class="css-g5y9jx r-1loqt21 r-1otgn73 r-1awozwy r-eu3ka r-1777fci r-13qz1uu">…</div> from <div class="css-g5y9jx r-1d2f490 r-u8s1d r-zchlnj r-12vffkv">…</div> subtree intercepts pointer events
      - retrying click action
        - waiting 500ms

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
          - button "Settings" [ref=e17] [cursor=pointer]:
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
        - generic [ref=e777]: Fri, Jul 3
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
  1  | /** Throwaway diagnostic probe — dead, never committed. Safe to delete. */
  2  | import { test } from '@playwright/test';
  3  | 
  4  | import { center, coldLoad, tapAt, visibleDay } from './app';
  5  | 
  6  | test('probe: console/page errors on taps; do taps register; any sheet DOM?', async ({ page }) => {
  7  |   page.on('console', (msg) => {
  8  |     if (msg.type() === 'error' || msg.type() === 'warning') {
  9  |       console.log(`PROBE console.${msg.type()}: ${msg.text().slice(0, 500)}`);
  10 |     }
  11 |   });
  12 |   page.on('pageerror', (err) => {
  13 |     console.log(`PROBE pageerror: ${String(err).slice(0, 800)}`);
  14 |   });
  15 | 
  16 |   const { fab, gear } = await coldLoad(page);
  17 | 
  18 |   // 1. Does a plain calendar-day tap register? (isolates tap delivery)
  19 |   const day = await visibleDay(page, 3);
  20 |   await tapAt(page, await center(day));
  21 |   await page.waitForTimeout(800);
  22 |   console.log(`PROBE day-3 tap: aria-selected=${await day.getAttribute('aria-selected')}`);
  23 | 
  24 |   // 2. Gear tap → what appears in the DOM?
  25 |   await tapAt(page, gear);
  26 |   await page.waitForTimeout(4000);
  27 |   const afterGear = await page.evaluate(() => {
  28 |     const ids = ['entry-sheet', 'settings-sheet', 'budgets-sheet'];
  29 |     const found = ids.filter((id) => document.querySelector(`[data-testid="${id}"]`));
  30 |     const bodyChildren = [...document.body.children].map(
  31 |       (c) => `${c.tagName}#${c.id || '-'} cls=${(c.className || '').toString().slice(0, 50)}`,
  32 |     );
  33 |     const modalish = document.querySelectorAll(
  34 |       '[class*="portal" i], [id*="portal" i], [class*="modal" i], [aria-modal]',
  35 |     ).length;
  36 |     return { found, bodyChildren, modalish };
  37 |   });
  38 |   console.log(`PROBE after gear tap: ${JSON.stringify(afterGear)}`);
  39 | 
  40 |   // 3. Second gear tap on the same load — first-tap-only or total failure?
  41 |   await tapAt(page, gear);
  42 |   await page.waitForTimeout(4000);
  43 |   const second = await page.evaluate(() =>
  44 |     ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
  45 |       document.querySelector(`[data-testid="${id}"]`),
  46 |     ),
  47 |   );
  48 |   console.log(`PROBE after second gear tap: ${JSON.stringify(second)}`);
  49 | 
  50 |   // 4. FAB tap too.
  51 |   await tapAt(page, fab);
  52 |   await page.waitForTimeout(4000);
  53 |   const afterFab = await page.evaluate(() =>
  54 |     ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
  55 |       document.querySelector(`[data-testid="${id}"]`),
  56 |     ),
  57 |   );
  58 |   console.log(`PROBE after fab tap: ${JSON.stringify(afterFab)}`);
  59 | 
  60 |   // 5. Locator-level click with Playwright's own actionability, as contrast.
> 61 |   await page.getByLabel('Settings', { exact: true }).click();
     |                                                      ^ Error: locator.click: Test timeout of 180000ms exceeded.
  62 |   await page.waitForTimeout(4000);
  63 |   const afterLocatorClick = await page.evaluate(() =>
  64 |     ['entry-sheet', 'settings-sheet', 'budgets-sheet'].filter((id) =>
  65 |       document.querySelector(`[data-testid="${id}"]`),
  66 |     ),
  67 |   );
  68 |   console.log(`PROBE after locator click on gear: ${JSON.stringify(afterLocatorClick)}`);
  69 | });
  70 | 
```