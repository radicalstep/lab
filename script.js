document.addEventListener('DOMContentLoaded', () => {
    // 要素の取得
    const animeFileInput = document.getElementById('anime-file-input');
    const realFileInput = document.getElementById('real-file-input');
    const animeImagePreview = document.getElementById('anime-image-preview');
    const realImagePreview = document.getElementById('real-image-preview');
    const compareAnimeImg = document.getElementById('compare-anime-img');
    const compareRealImg = document.getElementById('compare-real-img');
    const opacitySlider = document.getElementById('opacity-slider');
    const mapPlaceholder = document.getElementById('map-placeholder');
    const exifInfoPlaceholder = document.getElementById('exif-info-placeholder');
    const streetviewButton = document.getElementById('streetview-button');

    // アニメシーン画像のファイル選択時の処理
    animeFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                animeImagePreview.src = e.target.result;
                compareAnimeImg.src = e.target.result; // 比較ビューにも反映
            }
            reader.readAsDataURL(file);
            alert('アニメシーン画像が選択されました (プレビューに表示)');
        } else {
            // ファイルが選択されなかった場合やキャンセルされた場合
            animeImagePreview.src = 'https://via.placeholder.com/300x200.png?text=アニメシーン';
            compareAnimeImg.src = 'https://via.placeholder.com/400x300.png?text=アニメシーン';
        }
    });

    // 実写写真のファイル選択時の処理
    realFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                realImagePreview.src = e.target.result;
                compareRealImg.src = e.target.result; // 比較ビューにも反映

                // Exif情報取得と地図表示はダミー
                exifInfoPlaceholder.textContent = 'Exif情報: 緯度 35.681236, 経度 139.767125 (ダミー: 東京駅)';
                mapPlaceholder.innerHTML = `
                    <p><strong>ダミーの地図</strong></p>
                    <p>(実際の地図API連携は未実装です)</p>
                    <img src="https://via.placeholder.com/300x150.png?text=Map+Placeholder" alt="地図プレースホルダー" style="width:80%; opacity:0.7;">
                `;
                alert('実写写真が選択されました (プレビューとダミーの地図情報が表示されます)');
            }
            reader.readAsDataURL(file);
        } else {
            realImagePreview.src = 'https://via.placeholder.com/300x200.png?text=実写写真';
            compareRealImg.src = 'https://via.placeholder.com/400x300.png?text=あなたの写真';
            exifInfoPlaceholder.textContent = 'Exif情報: (ここに緯度経度などが表示される予定)';
            mapPlaceholder.textContent = 'ここに地図が表示されます（ダミー）';
        }
    });

    // スライダーのダミー動作
    opacitySlider.addEventListener('input', (event) => {
        const value = event.target.value;
        // 実際の重ね合わせ処理はCSSやCanvasで行いますが、ここではアラートのみ
        // 例: compareRealImg.style.opacity = value;
        //     compareAnimeImg.style.opacity = 1 - value;
        alert(`スライダーの値: ${value} (実際の画像重ね合わせ処理は未実装です)`);
        console.log('スライダー値:', value);
    });

    // 実写写真のファイル選択時の処理
    realFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                realImagePreview.src = e.target.result;
                compareRealImg.src = e.target.result; // 比較ビューにも反映

                // Exif情報取得と地図表示はダミー
                exifInfoPlaceholder.textContent = 'Exif情報: 緯度 35.681236, 経度 139.767125 (ダミー: 東京駅)';
                mapPlaceholder.innerHTML = `
                    <p><strong>ダミーの地図</strong></p>
                    <p>(実際の地図API連携は未実装です)</p>
                    <img src="https://via.placeholder.com/300x150.png?text=Map+Placeholder" alt="地図プレースホルダー" style="width:80%; opacity:0.7;">
                `;
                alert('実写写真が選択されました (プレビューとダミーの地図情報が表示されます)');

                // ★ 左ペインにサムネイルが追加されたことを示すダミーのアラート
                const thumbnailList = document.getElementById('thumbnail-list');
                // ダミーのサムネイル要素を作成して追加する例（実際にはもっと情報が必要）
                const newThumbnail = document.createElement('li');
                newThumbnail.innerHTML = `
                    <img src="${e.target.result}" alt="実写サムネイル" class="thumbnail-item-image real">
                    <img src="${animeImagePreview.src}" alt="アニメサムネイル" class="thumbnail-item-image anime">
                    <div class="thumbnail-item-info">
                        <span class="title">新しい聖地 (仮)</span>
                        <span class="date">${new Date().toLocaleDateString()}</span>
                    </div>
                `;
                // クリック時のダミー動作
                newThumbnail.addEventListener('click', () => {
                    alert('この聖地ペアの詳細を表示します (ダミー動作)');
                    // ここで右ペインの内容を選択された情報で更新する処理が入る
                });
                thumbnailList.appendChild(newThumbnail);
                alert('左ペインに新しい写真のサムネイルが追加されました（ダミー表示）。');

            }
            reader.readAsDataURL(file);
        } else {
            // ... (既存のファイル未選択時の処理) ...
        }
    });

    // 初期表示時のサムネイルにもクリックイベントを追加 (ダミー)
    const initialThumbnails = document.querySelectorAll('#thumbnail-list li');
    initialThumbnails.forEach(thumb => {
        thumb.addEventListener('click', () => {
            alert('この聖地ペアの詳細を表示します (ダミー動作)');
            // ここで右ペインの内容を選択された情報で更新する処理が入る
        });
    });

    // ストリートビューボタンのダミー動作
    streetviewButton.addEventListener('click', () => {
        const dummyLat = 35.681236;
        const dummyLng = 139.767125;
        alert(`ストリートビューを開きます (ダミー動作)\n緯度: ${dummyLat}, 経度: ${dummyLng} の場所を想定しています。\n実際の機能では、写真のExif情報から取得した位置で開きます。`);
        // 実際に開く場合の例 (コメントアウト)
        // window.open(`https://www.google.com/maps?q&layer=c&cbll=${dummyLat},${dummyLng}`, '_blank');
    });

    // 初期表示時のメッセージ
    alert('アニメ聖地比較アプリのデザイン案へようこそ！\nこれは見た目の確認用です。実際の機能はまだ実装されていません。\nファイルを選択すると、プレビューが更新されます。');
});
