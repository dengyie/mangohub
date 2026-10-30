package monitoring

import (
	"testing"
	"unicode/utf8"
)

func TestGpuName(t *testing.T) {
	name := GpuName()
	if name == "" || name == "Unknown" {
		t.Errorf("Expected GPU name, got empty or 'Unknown'")
	}
	t.Logf("GPU name: %s", name)
}

func TestFormatGPUNameList(t *testing.T) {
	got := formatGPUNameList([]string{
		"NVIDIA GeForce RTX 4090",
		"NVIDIA GeForce RTX 4090",
		"AMD Radeon RX 7900 XTX",
	})
	want := "NVIDIA GeForce RTX 4090 × 2, AMD Radeon RX 7900 XTX"
	if got != want {
		t.Fatalf("formatGPUNameList() = %q, want %q", got, want)
	}
}

// Windows 上装了虚拟显示驱动后，DXGI 会把同一块 NVIDIA 卡重复枚举多次
// （同名、同 vendor/device、仅 LUID 不同）。此时应以 nvidia-smi 的物理卡列表为准。
func TestBuildGPUNameListPrefersNvidiaSMI(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x00000000968A1604"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x00000000968A0AC5"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x000000000000BA34"},
		{Name: "Microsoft Basic Render Driver", VendorID: 0x1414, LUID: "0x000000000000C940", Software: true},
	}

	got := buildGPUNameList(adapters, []string{"NVIDIA GeForce RTX 3070"})
	if want := "NVIDIA GeForce RTX 3070"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListKeepsOtherVendors(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x1"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x2"},
		{Name: "Intel(R) UHD Graphics 770", VendorID: 0x8086, LUID: "0x3"},
	}

	got := buildGPUNameList(adapters, []string{"NVIDIA GeForce RTX 3070"})
	want := "NVIDIA GeForce RTX 3070, Intel(R) UHD Graphics 770"
	if got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListFallsBackToDXGI(t *testing.T) {
	adapters := []gpuAdapterName{
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x1"},
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x1"}, // 同一适配器重复返回
		{Name: "AMD Radeon RX 7900 XTX", VendorID: 0x1002, LUID: "0x2"}, // 第二块真实显卡
	}

	got := buildGPUNameList(adapters, nil)
	if want := "AMD Radeon RX 7900 XTX × 2"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListCountsRealMultiGPU(t *testing.T) {
	got := buildGPUNameList(nil, []string{
		"NVIDIA GeForce RTX 3070",
		"NVIDIA GeForce RTX 3070",
		"NVIDIA GeForce RTX 3070",
	})
	if want := "NVIDIA GeForce RTX 3070 × 3"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestBuildGPUNameListFallbackCannotTellIDDDuplicates(t *testing.T) {
	// 已知限制：没有 nvidia-smi 时，IDD 虚拟显示驱动造成的重复项 LUID 各不相同，
	// 与真实多卡无法区分，只能按原样计数。锁住这个行为，避免有人按 (vendor,device)
	// 去重而误伤真实多卡。
	adapters := []gpuAdapterName{
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x1"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x2"},
		{Name: "NVIDIA GeForce RTX 3070", VendorID: 0x10DE, LUID: "0x3"},
	}

	got := buildGPUNameList(adapters, nil)
	if want := "NVIDIA GeForce RTX 3070 × 3"; got != want {
		t.Fatalf("buildGPUNameList() = %q, want %q", got, want)
	}
}

func TestParseNvidiaSMINamesCRLF(t *testing.T) {
	// Windows 下 nvidia-smi 输出是 CRLF，行尾的 \r 不能留进型号里。
	got := parseNvidiaSMINames([]byte("NVIDIA GeForce RTX 3070\r\nNVIDIA GeForce RTX 4090\r\n"))
	want := []string{"NVIDIA GeForce RTX 3070", "NVIDIA GeForce RTX 4090"}
	if len(got) != len(want) {
		t.Fatalf("parseNvidiaSMINames() = %q, want %q", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("parseNvidiaSMINames()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestParseNvidiaSMINamesIgnoresBlankLines(t *testing.T) {
	got := parseNvidiaSMINames([]byte("\n  \r\nNVIDIA GeForce RTX 3070\n\t\n"))
	if len(got) != 1 || got[0] != "NVIDIA GeForce RTX 3070" {
		t.Fatalf("parseNvidiaSMINames() = %q, want single trimmed name", got)
	}

	if names := parseNvidiaSMINames(nil); len(names) != 0 {
		t.Fatalf("parseNvidiaSMINames(nil) = %q, want empty", names)
	}
}

func TestParseNvidiaSMINamesSanitizesInvalidUTF8(t *testing.T) {
	// 控制台代码页可能输出 GBK 字节（如中文用户名目录），不能让非法字节进入上报。
	got := parseNvidiaSMINames([]byte("NVIDIA GeForce RTX 3070\xbf\xe4\xbf\xcb\n"))
	if len(got) != 1 {
		t.Fatalf("parseNvidiaSMINames() = %q, want 1 name", got)
	}
	if !utf8.ValidString(got[0]) {
		t.Fatalf("parseNvidiaSMINames() returned invalid UTF-8: %q", got[0])
	}
}
