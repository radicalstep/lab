document.addEventListener('DOMContentLoaded', () => {
    // 左ペイン
    const filterList = document.getElementById('filter-list');

    // 右ペイン
    const rightPaneHeaderTitle = document.getElementById('right-pane-header-title');
    const closeDetailViewButton = document.getElementById('close-detail-view-button');
    const photoGalleryContainer = document.getElementById('photo-gallery-container');
    const detailViewContainer = document.getElementById('detail-view-container');

    // 詳細ビュー：画像ペイン
    const detailSingleImageView = document.getElementById('detail-single-image-view');
    const detailModalImage = document.getElementById('detail-modal-image');
    const detailSideBySideView = document.getElementById('detail-side-by-side-view');
    const detailSbsAnimeImage = document.getElementById('detail-sbs-anime-image');
    const detailSbsRealImage = document.getElementById('detail-sbs-real-image');
    const detailToggleComparisonButton = document.getElementById('detail-toggle-comparison-button');

    // 詳細ビュー：情報ペイン
    const detailTitle = document.getElementById('detail-title');
    const detailAnimeTitleDisplay = document.getElementById('detail-anime-title-display');
    const detailPhotoDescription = document.getElementById('detail-photo-description');
    const detailMapPlaceholder = document.getElementById('detail-map-placeholder');
    const detailStreetviewLink = document.getElementById('detail-streetview-link');


    // ダミーの写真データ
    const dummyPhotos = [
        { id: 1, realSrc: 'https://via.placeholder.com/1000x750/A8D8EA/000?text=聖地A実写', animeSrc: 'https://via.placeholder.com/1000x750/FFD3B4/000?text=聖地Aアニメ', thumbnailSrc: 'https://via.placeholder.com/200x150/A8D8EA/000?text=聖地A', title: '旧碓氷峠見晴台', animeTitle: 'anime-a', description: 'アニメAの第3話に登場した見晴台。素晴らしい景色が広がります。頂上からの眺めはまさに絶景で、多くのファンが訪れる聖地の一つです。特に夕暮れ時は感動的。', lat: 36.395, lng: 138.693, animeTitleDisplay: 'あの夏で待ってる' },
        { id: 2, realSrc: 'https://via.placeholder.com/1000x750/C1E1C1/000?text=聖地B実写', animeSrc: 'https://via.placeholder.com/1000x750/F7C8E0/000?text=聖地Bアニメ', thumbnailSrc: 'https://via.placeholder.com/200x150/C1E1C1/000?text=聖地B', title: '本栖湖キャンプ場', animeTitle: 'anime-b', description: 'アニメBのメインビジュアルにもなったキャンプ場。富士山が綺麗に見えることで有名で、冬キャンプのシーンは特に印象的でした。湖畔でのんびり過ごす時間は最高。', lat: 35.470, lng: 138.588, animeTitleDisplay: 'ゆるキャン△' },
        { id: 3, realSrc: 'https://via.placeholder.com/1000x750/E6E6FA/000?text=聖地C実写', animeSrc: 'https://via.placeholder.com/1000x750/FFFACD/000?text=聖地Cアニメ', thumbnailSrc: 'https://via.placeholder.com/200x150/E6E6FA/000?text=聖地C', title: '宇治橋', animeTitle: 'anime-c', description: 'アニメCで何度も登場する宇治の象徴的な橋です。登場人物たちの心情が描かれる重要なシーンで背景として使われることが多く、物語の雰囲気を高めています。', lat: 34.890, lng: 135.807, animeTitleDisplay: '響け！ユーフォニアム' },
        { id: 4, realSrc: 'https://via.placeholder.com/1000x750/BDB5D5/000?text=聖地D実写', animeSrc: 'https://via.placeholder.com/1000x750/F0E68C/000?text=聖地Dアニメ', thumbnailSrc: 'https://via.placeholder.com/200x150/BDB5D5/000?text=聖地D', title: '小諸駅前', animeTitle: 'anime-a', description: 'アニメAのキャラクターたちがよく利用していた駅の周辺。待ち合わせ場所や日常風景として描かれています。駅舎のデザインも特徴的。', lat: 36.326, lng: 138.421, animeTitleDisplay: 'あの夏で待ってる' },
        { id: 5, realSrc: 'https://via.placeholder.com/1000x750/FFB6C1/000?text=聖地E実写', animeSrc: 'https://via.placeholder.com/1000x750/ADD8E6/000?text=聖地Eアニメ', thumbnailSrc: 'https://via.placeholder.com/200x150/FFB6C1/000?text=聖地E', title: '高ボッチ高原', animeTitle: 'anime-b', description: 'アニメBでリンちゃんが訪れた絶景スポット。夜景も有名ですが、昼間の景色も素晴らしい。作中ではここでスープを飲むシーンがありましたね。', lat: 36.151, lng: 138.036, animeTitleDisplay: 'ゆるキャン△' }
    ];

    let currentPhotoData = null;
    let isRealImageDisplayedInSingleView = true; // ★これがtrueなら実写が先
    let isDetailSideBySideActive = false;

    // 写真タイルをギャラリーに表示
    function displayPhotos(photosToDisplay) {
        photoGalleryContainer.innerHTML = '';
        photosToDisplay.forEach(photo => {
            const tile = document.createElement('div');
            tile.classList.add('photo-tile');
            tile.dataset.photoId = photo.id;

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
            tile.addEventListener('click', () => openDetailView(photo.id));
        });
    }

    // 詳細ビューを開く
    function openDetailView(photoId) {
        currentPhotoData = dummyPhotos.find(p => p.id === parseInt(photoId));
        if (!currentPhotoData) return;

        photoGalleryContainer.classList.remove('active-content');
        detailViewContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = currentPhotoData.title;
        closeDetailViewButton.style.display = 'inline-block';

        // 画像設定
        isRealImageDisplayedInSingleView = true; // ★常に実写を最初に表示
        detailModalImage.src = currentPhotoData.realSrc; // ★実写のURLをセット
        detailSbsAnimeImage.src = currentPhotoData.animeSrc;
        detailSbsRealImage.src = currentPhotoData.realSrc;
        switchToDetailSingleView();

        // 情報設定
        detailTitle.textContent = currentPhotoData.title;
        detailAnimeTitleDisplay.textContent = `アニメ: ${currentPhotoData.animeTitleDisplay}`;
        detailPhotoDescription.textContent = currentPhotoData.description;
        detailMapPlaceholder.innerHTML = `
            ダミー地図 (Leafletなどで描画予定)<br>
            緯度: ${currentPhotoData.lat}, 経度: ${currentPhotoData.lng}
        `;
        const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${currentPhotoData.lat},${currentPhotoData.lng}`;
        detailStreetviewLink.href = streetViewUrl;
        detailStreetviewLink.style.display = 'inline-block';
        detailStreetviewLink.innerHTML = `<i class="fas fa-street-view"></i> 「${currentPhotoData.title}」をストリートビューで見る`;
    }

    // 詳細ビューを閉じてギャラリーに戻る
    function closeDetailView() {
        detailViewContainer.classList.remove('active-content');
        photoGalleryContainer.classList.add('active-content');
        rightPaneHeaderTitle.textContent = '聖地写真ギャラリー';
        closeDetailViewButton.style.display = 'none';
        currentPhotoData = null;
    }
    closeDetailViewButton.addEventListener('click', closeDetailView);


    // 詳細ビュー：通常表示に切り替え
    function switchToDetailSingleView() {
        detailSingleImageView.classList.add('active-detail-image-display');
        detailSideBySideView.classList.remove('active-detail-image-display');
        detailToggleComparisonButton.textContent = '左右で比較する';
        isDetailSideBySideActive = false;
    }

    // 詳細ビュー：左右比較表示に切り替え
    function switchToDetailSideBySideView() {
        detailSingleImageView.classList.remove('active-detail-image-display');
        detailSideBySideView.classList.add('active-detail-image-display');
        detailToggleComparisonButton.textContent = '1枚表示に戻す';
        isDetailSideBySideActive = true;
    }

    // 詳細ビュー：通常表示の画像クリックで実写/アニメシーン切り替え
    detailModalImage.addEventListener('click', () => {
        if (!currentPhotoData || isDetailSideBySideActive) return;
        if (isRealImageDisplayedInSingleView) {
            detailModalImage.src = currentPhotoData.animeSrc;
        } else {
            detailModalImage.src = currentPhotoData.realSrc;
        }
        isRealImageDisplayedInSingleView = !isRealImageDisplayedInSingleView;
    });

    // 詳細ビュー：「左右で比較する / 1枚表示に戻す」ボタンの処理
    detailToggleComparisonButton.addEventListener('click', () => {
        if (!currentPhotoData) return;
        if (isDetailSideBySideActive) {
            switchToDetailSingleView();
        } else {
            switchToDetailSideBySideView();
        }
    });

    // 左ペインのフィルター処理
    filterList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            if (detailViewContainer.classList.contains('active-content')) {
                closeDetailView();
            }

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
        }
    });

    // 初期表示 (すべての写真を表示)
    photoGalleryContainer.classList.add('active-content');
    displayPhotos(dummyPhotos);
});
