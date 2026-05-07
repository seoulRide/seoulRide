# 서울 OpenAPI 서비스별 필드 사전

각 서비스의 응답 row[] 안에 등장하는 주요 필드를 모은 참조표다. 정확한 정의는 data.seoul.go.kr 각 서비스 명세를 따른다.

## cycleForeignerRentMonthInfo (외국인 따릉이 월별)

| 필드 | 의미 |
|------|------|
| YEAR_MONTH | 기준 연월 (YYYYMM) |
| STATION_NO | 대여소 번호 |
| RENT_CNT | 대여건수 |
| RTN_CNT | 반납건수 (선택) |

## cycleForeignerRentDayInfo (외국인 따릉이 일별)

| 필드 | 의미 |
|------|------|
| RENT_DT | 대여일자 (YYYYMMDD) |
| RENT_NO | 대여소 번호 |
| RENT_NM | 대여소 이름 |
| RENT_CNT | 대여건수 |
| RTN_CNT | 반납건수 |

## culturalEventInfo (서울문화포털 문화행사)

| 필드 | 의미 |
|------|------|
| CODENAME | 분류 (콘서트/뮤지컬/오페라/전시·미술 등) |
| GUNAME | 자치구 |
| TITLE | 행사명 |
| PLACE | 장소 |
| ORG_NAME | 기관명 |
| USE_TRGT | 이용대상 |
| USE_FEE | 이용요금 |
| PROGRAM | 프로그램 |
| ETC_DESC | 기타설명 |
| ORG_LINK | 홈페이지 |
| MAIN_IMG | 대표이미지 |
| RGSTDATE | 등록일 |
| TICKET | 시민/기관 |
| STRTDATE | 시작일 (YYYY-MM-DD HH:mm:ss.0) |
| ENDDATE | 종료일 |
| THEMECODE | 테마 |
| LOT | 경도 (longitude) |
| LAT | 위도 (latitude) |
| IS_FREE | 유무료 (무료/유료) |
| HMPG_ADDR | 홈페이지 주소 |

## ListPublicReservationCulture (문화행사 예약)

| 필드 | 의미 |
|------|------|
| GUBUN | 서비스 구분 |
| SVCID | 서비스 ID |
| MAXCLASSNM | 대분류명 (문화체험/공연 등) |
| MINCLASSNM | 소분류명 |
| SVCSTATNM | 서비스 상태 (접수중/접수종료 등) |
| SVCNM | 서비스명 |
| PAYATNM | 유무료 |
| PLACENM | 장소명 |
| USETGTINFO | 이용대상 |
| SVCURL | 바로가기 URL |
| X | 경도 |
| Y | 위도 |
| AREANM | 자치구명 |
| RCPTBGNDT | 접수시작일시 |
| RCPTENDDT | 접수종료일시 |
| SVCOPNBGNDT | 서비스 시작일시 |
| SVCOPNENDDT | 서비스 종료일시 |

## ListPublicReservationEnglish (영문 예약)

ListPublicReservationCulture와 동일 스키마, 콘텐츠가 영문.

## SJWPerform (세종문화회관)

| 필드 | 의미 |
|------|------|
| KIDX | 공연 고유 ID |
| GUBN | 공연/전시 구분 |
| GENRE | 장르 |
| SUBJECT | 제목 |
| PLACE | 공연장 |
| ST_DATE / ED_DATE | 시작/종료일 |
| HOLD_AT | 주최 |
| TICKET | 티켓 등급/가격 |
| LANG | 언어 |
| RUNTIME | 러닝타임 |

## trdarNcmCnsmp (상권분석 - 소비)

| 필드 | 의미 |
|------|------|
| STDR_YYQU_CD | 기준 연분기 (예: 20254) |
| TRDAR_SE_CD | 상권 구분 코드 |
| TRDAR_CD | 상권 코드 |
| TRDAR_CD_NM | 상권 이름 |
| MT_CNSMP_AMT | 월 평균 소비액(추정) |
| FOOD_CNSMP_AMT | 음식 소비액(추정) |
| ... | 카테고리별 소비액 |

전체 컬럼 정의는 data.seoul.go.kr 명세 참조.
