# Memory-only Windows OCR. Input is bounded PNG base64 on stdin; no paths or URLs.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$stream = $null
$bitmap = $null
try {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime] > $null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime] > $null
    [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Foundation, ContentType=WindowsRuntime] > $null
    [Windows.Storage.Streams.DataWriter, Windows.Foundation, ContentType=WindowsRuntime] > $null
    $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and
        $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    function Await-Operation($operation, [Type]$resultType) {
        $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
        return $task.GetAwaiter().GetResult()
    }
    $languages = @([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages)
    $language = $languages | Where-Object LanguageTag -like 'zh-*' | Select-Object -First 1
    if (-not $language) { $language = $languages | Select-Object -First 1 }
    if (-not $language) { throw 'OCR_UNAVAILABLE' }
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
    if (-not $engine) { throw 'OCR_UNAVAILABLE' }
    $inputText = [Console]::In.ReadToEnd()
    if ($inputText.Length -gt 8400000) { throw 'OCR_IMAGE_INVALID' }
    $payload = $inputText | ConvertFrom-Json
    $bytes = [Convert]::FromBase64String($payload.base64)
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 6291456) { throw 'OCR_IMAGE_INVALID' }
    $stream = [Windows.Storage.Streams.InMemoryRandomAccessStream]::new()
    $writer = [Windows.Storage.Streams.DataWriter]::new($stream)
    try {
        $writer.WriteBytes($bytes)
        $null = Await-Operation ($writer.StoreAsync()) ([UInt32])
        $null = $writer.DetachStream()
    } finally { $writer.Dispose() }
    $stream.Seek(0)
    $decoder = Await-Operation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    if ($decoder.PixelWidth -eq 0 -or $decoder.PixelHeight -eq 0 -or $decoder.PixelWidth -gt 2600 -or $decoder.PixelHeight -gt 2600) { throw 'OCR_IMAGE_INVALID' }
    $bitmap = Await-Operation ($decoder.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Ignore)) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $result = Await-Operation ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $text = ($result.Lines | ForEach-Object { $_.Text }) -join "`n"
    if ([string]::IsNullOrWhiteSpace($text)) { throw 'OCR_EMPTY' }
    if ($text.Length -gt 64000) { throw 'OCR_TEXT_LIMIT' }
    [Console]::Out.Write((@{ text=$text.Trim(); language=$language.LanguageTag; engine='Windows OCR' } | ConvertTo-Json -Compress))
} catch {
    $code = $_.Exception.Message
    if ($code -notin @('OCR_UNAVAILABLE','OCR_EMPTY','OCR_IMAGE_INVALID','OCR_TEXT_LIMIT')) { $code = 'OCR_FAILED' }
    [Console]::Out.Write((@{ error=$code } | ConvertTo-Json -Compress))
    exit 1
} finally {
    if ($bitmap) { $bitmap.Dispose() }
    if ($stream) { $stream.Dispose() }
}
