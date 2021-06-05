<?php

$mode = $_POST['mode']??'';

$roomId = $_POST['roomId'] ?? 'test';
if(!preg_match("/^[a-zA-Z0-9]+$/", $roomId)){
    echo json_encode(['result' => false, 'message' => 'roomIdには半角英数のみ利用可能です']);
    exit();
}
if(!is_dir("./tmp/{$roomId}")){
    echo json_encode(['result' => false, 'message' => 'roomIdが存在しません']);
    exit();
}

switch($mode){
    case 'joinRoom':
        if(file_exists("./tmp/{$roomId}/send")){
            $data = json_decode(file_get_contents("./tmp/{$roomId}/send"), true);
            echo json_encode(['result' => true, 'role' => 'answer', 'sdp' => $data['sdp']]);
        }else{
            echo json_encode(['result' => true, 'role' => 'offer']);
        }
        break;
    case 'offer':
        $sdp = $_POST['sdp'] ?? '';
        file_put_contents("./tmp/{$roomId}/send", json_encode(['sdp' => $sdp]));
        echo json_encode(['result' => true]);
        break;
    case 'answer':
        $sdp = $_POST['sdp'] ?? '';
        file_put_contents("./tmp/{$roomId}/recv", json_encode(['sdp' => $sdp]));
        echo json_encode(['result' => true]);
        unlink("./tmp/${roomId}/send");
        break;
    case 'getAnswer':
        if(!file_exists("./tmp/{$roomId}/recv")){
            echo json_encode(['result' => true, 'status' => 'wait']);
        }else{
            $data = json_decode(file_get_contents("./tmp/{$roomId}/recv"), true);
            echo json_encode(['result' => true, 'status' => 'found', 'sdp' => $data['sdp']]);
            unlink("./tmp/{$roomId}/recv");
        }
        break;
}