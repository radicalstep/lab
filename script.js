document.addEventListener('DOMContentLoaded', () => {
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const filterList = document.getElementById('filter-list');
    const modal = document.getElementById('photo-modal');
    const modalImage = document.getElementById('modal-image');
    const modalCloseButton = document.querySelector('.modal-close-button');
    const showDetailsButton = document.getElementById('show-details-button');
    const photoDetailsArea = document.getElementById('photo-details-area');
    const photoDescription = document.getElementById('photo-description');
    const mapPlaceholderModal = document.getElementById('map-placeholder-modal');
    const streetviewLinkModal = document.getElementById('streetview-link-modal');

    // ダミーの写真データ
    const dummyPhotos = [
        {
            id: 1,
            realSrc: 'https://via.placeholder.com/600x400.png?text=聖地A実写',
            animeSrc: 'https://via.placeholder.com/600x400.png?text=聖地Aアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地A',
            title: '旧碓氷峠見晴台',
            animeTitle: 'anime-a', // アニメAのID
            description: 'アニメAの第3話に登場した見晴台。素晴らしい景色が広がります。',
            lat: 36.395, lng: 138.693, // ダミー座標 (軽井沢付近)
            animeTitleDisplay: 'あの夏で待ってる'
        },
        {
            id: 2,
            realSrc: 'https://via.placeholder.com/600x400.png?text=聖地B実写',
            animeSrc: 'https://via.placeholder.com/600x400.png?text=聖地Bアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地B',
            title: '本栖湖キャンプ場',
            animeTitle: 'anime-b', // アニメBのID
            description: 'アニメBのメインビジュアルにもなったキャンプ場。富士山が綺麗。',
            lat: 35.470, lng: 138.588, // ダミー座標 (本栖湖付近)
            animeTitleDisplay: 'ゆるキャン△'
        },
        {
            id: 3,
            realSrc: 'https://via.placeholder.com/600x400.png?text=聖地C実写',
            animeSrc: 'https://via.placeholder.com/600x400.png?text=聖地Cアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地C',
            title: '宇治橋',
            animeTitle: 'anime-c', // アニメCのID
            description: 'アニメCで何度も登場する宇治の象徴的な橋です。',
            lat: 34.890, lng: 135.807, // ダミー座標 (宇治橋付近)
            animeTitleDisplay: '響け！ユーフォニアム'
        },
        {
            id: 4,
            realSrc: 'https://via.placeholder.com/600x400.png?text=聖地D実写',
            animeSrc: 'https://via.placeholder.com/600x400.png?text=聖地Dアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地D',
            title: '小諸駅前',
            animeTitle: 'anime-a',
            description: 'アニメAのキャラクターたちがよく利用していた駅です。',
            lat: 36.326, lng: 138.421, // ダミー座標 (小諸駅付近)
            animeTitleDisplay: 'あの夏で待ってる'
        },
        {
            id: 5,
            realSrc: 'https://via.placeholder.com/600x400.png?text=聖地E実写',
            animeSrc: 'https://via.placeholder.com/600x400.png?text=聖地Eアニメ',
            thumbnailSrc: 'https://via.placeholder.com/200x150.png?text=聖地E',
            title: '高ボッチ高原',
            animeTitle: 'anime-b',
            description: 'アニメBでリンちゃんが訪れた絶景スポット。夜景も有名。',
            lat: 36.151, lng: 138.036, // ダミー座標 (高ボッチ高原付近)
            animeTitleDisplay: 'ゆるキャン△'
        }
    ];

    let currentPhotoData = null; // モーダルで表示中の写真データ
    let isRealImageDisplayed = true; // モーダルで実写が表示されているか

    // 写真タイルをギャラリーに表示する関数
    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = ''; // コンテナをクリア
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id; // カスタムデータ属性でIDを保持

            const img = document.createElement('img');
            img.src = photo.thumbnailSrc;
            img.alt = photo.title;

            const infoDiv = document.createElement('div');
            infoDiv.classList.add('photo-tile-info');
            infoDiv.innerHTML = `
                <span class="title">${photo.title}</span>
                <span class="anime-title">${photo.animeTitleDisplay}</span>
            `;

            tile.appendChild(img);
            tile.appendChild(infoDiv);
            photoGalleryContainer.appendChild(tile);

            // タイルクリックでモーダル表示
            tile.addEventListener('click', () => openModal(photo.id));
        });
    }

    // モーダルを開く関数
    function openModal(photoId) {
        currentPhotoData = dummyPhotos.find(p => p.id === parseInt(photoId));
        if (!currentPhotoData) return;

        isRealImageDisplayed = true; // 初期は実写を表示
        modalImage.src = currentPhotoData.realSrc;
        modal.style.display = 'block';
        photoDetailsArea.style.display = 'none'; // 詳細エリアは初期非表示
        showDetailsButton.textContent = '詳細を見る';

        // アラートでお知らせ (開発用)
        alert(`写真ID: ${photoId} の拡大表示\n画像クリックでアニメシーンと切り替わります。`);
    }

    // モーダルを閉じる
    modalCloseButton.onclick = () => {
        modal.style.display = 'none';
        currentPhotoData = null;
    }
    window.onclick = (event) => { // モーダル外クリックでも閉じる
        if (event.target == modal) {
            modal.style.display = 'none';
            currentPhotoData = null;
        }
    }

    // モーダル内の画像クリックで実写/アニメシーン切り替え
    modalImage.addEventListener('click', () => {
        if (!currentPhotoData) return;
        if (isRealImageDisplayed) {
            modalImage.src = currentPhotoData.animeSrc;
            //alert('アニメシーン画像に切り替えました。');
        } else {
            modalImage.src = currentPhotoData.realSrc;
            //alert('実写画像に切り替えました。');
        }
        isRealImageDisplayed = !isRealImageDisplayed;
    });

    // 「詳細を見る/閉じる」ボタンの処理
    showDetailsButton.addEventListener('click', () => {
        if (!currentPhotoData) return;

        if (photoDetailsArea.style.display === 'none') {
            photoDescription.textContent = currentPhotoData.description;
            mapPlaceholderModal.innerHTML = `
                ダミー地図 (Leafletなどで描画予定)<br>
                緯度: ${currentPhotoData.lat}, 経度: ${currentPhotoData.lng}
            `;
            // ダミーのストリートビューリンク
            const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${currentPhotoData.lat},${currentPhotoData.lng}`;
            streetviewLinkModal.href = streetViewUrl;
            streetviewLinkModal.style.display = 'inline-block';
            streetviewLinkModal.textContent = `ストリートビューで「${currentPhotoData.title}」の場所を見る (ダミー)`;


            photoDetailsArea.style.display = 'block';
            showDetailsButton.textContent = '詳細を閉じる';
            alert('詳細情報を表示しました。');
        } else {
            photoDetailsArea.style.display = 'none';
            showDetailsButton.textContent = '詳細を見る';
            alert('詳細情報を閉じました。');
        }
    });

    // 左ペインのフィルター処理
    filterList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            // アクティブクラスの切り替え
            document.querySelectorAll('#filter-list .filter-item').forEach(item => item.classList.remove('active'));
            event.target.classList.add('active');

            const filterType = event.target.dataset.filter;
            let filteredPhotos;
            if (filterType === 'all') {
                filteredPhotos = dummyPhotos;
            } else {
                filteredPhotos = dummyPhotos.filter(photo => photo.animeTitle === filterType);
            }
            displayPhotos(filteredPhotos);
            //alert(`フィルター「${event.target.textContent}」が選択されました。`);
        }
    });

    // 初期表示 (すべての写真を表示)
    displayPhotos(dummyPhotos);
    //alert('アニメ聖地ギャラリーへようこそ！\nこれは見た目の確認用モックアップです。\n左のフィルターや写真タイルをクリックしてみてください。');
});
