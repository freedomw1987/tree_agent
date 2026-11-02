fn main() {
    // `.ios_path("ios")` 會令 build script：
    //  1) 由 tauri crate 複製 Tauri Swift API 去 .tauri/tauri-api
    //  2) 編譯 ios/Package.swift（Swift package）並輸出 link 路徑
    tauri_plugin::Builder::new(&["start", "stop"])
        .ios_path("ios")
        .build();
}
