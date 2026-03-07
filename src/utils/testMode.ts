type SearchParamsLike = {
  get: (key: string) => string | null;
};

type TestModeResult = {
  isTestMode: boolean;
  testQuerySuffix: string;
};

export function resolveTestMode(searchParams: SearchParamsLike): TestModeResult {
  const testParam = searchParams.get("test");
  const testKey = searchParams.get("testKey");
  const ownerKey = process.env.NEXT_PUBLIC_TEST_MODE_OWNER_KEY?.trim() ?? "";
  const isDevelopment = process.env.NODE_ENV === "development";

  const isDevelopmentMode = isDevelopment && testParam !== "false";
  const isOwnerMode = Boolean(ownerKey && testParam === "true" && testKey === ownerKey);
  const isTestMode = isDevelopmentMode || isOwnerMode;

  const queryParams = new URLSearchParams();

  if (testParam === "true") {
    queryParams.set("test", "true");
  }

  if (isOwnerMode && testKey) {
    queryParams.set("testKey", testKey);
  }

  const queryString = queryParams.toString();

  return {
    isTestMode,
    testQuerySuffix: queryString ? `?${queryString}` : "",
  };
}